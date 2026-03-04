"""
Enterprise Speaker Diarization Service v2
==========================================
FastAPI microservice combining Pyannote Audio speaker diarization
with OpenAI Whisper word-level transcription for enterprise-grade
meeting transcript generation with per-speaker timestamps.

Architecture:
  1. Pyannote Pipeline  → WHO spoke WHEN (speaker segments)
  2. Noise Filtering    → Remove short spurious segments (<300ms)
  3. Segment Merging    → Merge adjacent same-speaker segments with small gaps
  4. Whisper (local)    → WHAT was said with word-level timestamps
  5. Weighted Alignment → Map words to speakers with overlap + proximity scoring
  6. Block Smoothing    → Eliminate single-word speaker flickers
  7. Block Assembly     → Contiguous speaker blocks with timestamps

Enterprise Enhancements:
  - Configurable clustering threshold for speaker discrimination
  - Min/max speaker count constraints
  - Noise segment filtering (removes <300ms artifacts)
  - Adjacent segment merging (consolidates same-speaker gaps <500ms)
  - Weighted word-to-speaker alignment (overlap + distance + previous-speaker bias)
  - Post-processing smoothing (removes single-word speaker flickers)
  - Quality metrics in response (avg confidence, diarization coverage)

Author: Dashmet Meeting Intelligence
"""

import os
import io
import uuid
import tempfile
import logging
import time
import threading
from pathlib import Path
from typing import Optional
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch
import soundfile as sf
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("diarization-service")

# ──────────────────────────────────────────────────────────
# App Initialization
# ──────────────────────────────────────────────────────────
app = FastAPI(
    title="Dashmet Speaker Diarization Service",
    description="Enterprise-grade Pyannote + Whisper speaker diarization",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────
# Global Model Cache (loaded once at startup)
# ──────────────────────────────────────────────────────────
_diarization_pipeline = None
_whisper_model = None

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")  # tiny|base|small|medium|large-v3
HF_AUTH_TOKEN = os.getenv("HUGGINGFACE_TOKEN", "")

# ── Enterprise Tuning Defaults ────────────────────────────
# Clustering threshold: higher = fewer speakers (merge similar voices),
# lower = more speakers (split aggressively). Range: 0.3 - 0.95
DEFAULT_CLUSTERING_THRESHOLD = float(os.getenv("CLUSTERING_THRESHOLD", "0.65"))
# Minimum segment duration in seconds — segments shorter than this
# are likely noise / classification artifacts and will be removed
MIN_SEGMENT_DURATION = float(os.getenv("MIN_SEGMENT_DURATION", "0.3"))
# Maximum gap (seconds) between same-speaker segments to merge
# into one continuous segment (prevents over-fragmentation)
SAME_SPEAKER_MERGE_GAP = float(os.getenv("SAME_SPEAKER_MERGE_GAP", "0.5"))
# Minimum words for a speaker block — blocks shorter than this
# surrounded by the same speaker are absorbed (smoothing)
MIN_BLOCK_WORDS = int(os.getenv("MIN_BLOCK_WORDS", "2"))


def get_diarization_pipeline(clustering_threshold: Optional[float] = None):
    """
    Lazy-load Pyannote speaker diarization pipeline.
    Optionally tune the clustering threshold for speaker discrimination.
    """
    global _diarization_pipeline
    if _diarization_pipeline is None:
        logger.info("Loading Pyannote speaker diarization pipeline…")
        from pyannote.audio import Pipeline

        _diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=HF_AUTH_TOKEN,
        )
        if DEVICE == "cuda":
            _diarization_pipeline.to(torch.device("cuda"))
        logger.info(f"Pyannote pipeline loaded on {DEVICE}")

    # Apply clustering threshold tuning when requested
    threshold = clustering_threshold or DEFAULT_CLUSTERING_THRESHOLD
    try:
        params = _diarization_pipeline.parameters(instantiated=True)
        if hasattr(params, 'clustering') or 'clustering' in str(type(params)):
            # Pyannote 3.x uses AgglomerativeClustering with a threshold
            _diarization_pipeline.instantiate({
                "clustering": {"method": "centroid", "threshold": threshold}
            })
            logger.info(f"Clustering threshold set to {threshold}")
    except Exception as e:
        # If threshold tuning fails, continue with defaults
        logger.warning(f"Could not set clustering threshold: {e} — using pipeline defaults")

    return _diarization_pipeline


def get_whisper_model():
    """Lazy-load local Whisper model."""
    global _whisper_model
    if _whisper_model is None:
        logger.info(f"Loading Whisper model '{WHISPER_MODEL_SIZE}'…")
        import whisper

        _whisper_model = whisper.load_model(WHISPER_MODEL_SIZE, device=DEVICE)
        logger.info(f"Whisper model loaded on {DEVICE}")
    return _whisper_model


# ──────────────────────────────────────────────────────────
# Response Models
# ──────────────────────────────────────────────────────────
class TranscriptWord(BaseModel):
    word: str
    start: float
    end: float
    speaker: str
    confidence: float


class TranscriptBlock(BaseModel):
    speaker: str
    content: str
    startTime: float
    endTime: float
    confidence: float
    wordCount: int


class QualityMetrics(BaseModel):
    """Enterprise quality metrics for the diarization result."""
    avgConfidence: float = 0.0
    diarizationCoverage: float = 0.0  # % of audio duration covered by speech
    segmentsBeforeFilter: int = 0
    segmentsAfterFilter: int = 0
    segmentsAfterMerge: int = 0
    smoothedBlocks: int = 0  # blocks removed by smoothing
    clusteringThreshold: float = 0.0


class DiarizationResponse(BaseModel):
    success: bool
    blocks: list[TranscriptBlock]
    speakers: list[str]
    speakerCount: int
    totalDuration: float
    totalWords: int
    language: str
    processingTimeSeconds: float
    error: Optional[str] = None
    qualityMetrics: Optional[QualityMetrics] = None


class JobSubmitResponse(BaseModel):
    jobId: str
    status: str


class JobStatusResponse(BaseModel):
    jobId: str
    status: str  # processing | complete | failed
    progress: Optional[str] = None
    result: Optional[DiarizationResponse] = None


# ──────────────────────────────────────────────────────────
# Background Job Infrastructure
# ──────────────────────────────────────────────────────────
_job_store: dict[str, dict] = {}  # job_id -> { status, progress, result }
_job_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=1)  # Single worker — models not thread-safe


def _update_job(job_id: str, **kwargs):
    """Thread-safe job store update."""
    with _job_lock:
        if job_id in _job_store:
            _job_store[job_id].update(kwargs)


def _get_job(job_id: str) -> Optional[dict]:
    """Thread-safe job retrieval."""
    with _job_lock:
        return _job_store.get(job_id, {}).copy() if job_id in _job_store else None


class HealthResponse(BaseModel):
    status: str
    device: str
    whisperModel: str
    pyannoteLoaded: bool
    whisperLoaded: bool
    clusteringThreshold: float
    minSegmentDuration: float
    sameSpkMergeGap: float


# ──────────────────────────────────────────────────────────
# Core Engine: Diarization + Transcription + Alignment
# ──────────────────────────────────────────────────────────

def convert_to_wav(audio_bytes: bytes, filename: str) -> str:
    """Convert any audio format to 16kHz mono WAV (required by both Pyannote & Whisper)."""
    from pydub import AudioSegment

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    ext = Path(filename).suffix.lower().lstrip(".")
    fmt_map = {
        "m4a": "m4a", "mp4": "mp4", "mp3": "mp3", "ogg": "ogg",
        "flac": "flac", "wav": "wav", "webm": "webm", "aac": "aac",
    }
    fmt = fmt_map.get(ext, "m4a")

    try:
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
    except Exception:
        # Fallback: let pydub auto-detect
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))

    # Convert to 16kHz mono (Pyannote & Whisper optimized)
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    audio.export(tmp.name, format="wav")

    logger.info(f"Converted audio → WAV 16kHz mono | {len(audio) / 1000:.1f}s")
    return tmp.name


def run_diarization(
    wav_path: str,
    num_speakers: Optional[int] = None,
    min_speakers: Optional[int] = None,
    max_speakers: Optional[int] = None,
    clustering_threshold: Optional[float] = None,
) -> tuple[list[dict], dict]:
    """
    Run Pyannote speaker diarization with enterprise tuning.
    Returns (segments, metrics) where segments = [{ speaker, start, end }]
    and metrics = { segmentsBeforeFilter, segmentsAfterFilter, segmentsAfterMerge, ... }
    """
    pipeline = get_diarization_pipeline(clustering_threshold)

    logger.info("Running speaker diarization…")
    kwargs = {}
    if num_speakers is not None and num_speakers > 0:
        kwargs["num_speakers"] = num_speakers
    if min_speakers is not None and min_speakers > 0:
        kwargs["min_speakers"] = min_speakers
    if max_speakers is not None and max_speakers > 0:
        kwargs["max_speakers"] = max_speakers

    diarization_result = pipeline(wav_path, **kwargs)

    raw_segments = []
    for turn, _, speaker in diarization_result.itertracks(yield_label=True):
        raw_segments.append({
            "speaker": speaker,
            "start": round(turn.start, 3),
            "end": round(turn.end, 3),
        })

    segments_before = len(raw_segments)
    unique_before = len(set(s['speaker'] for s in raw_segments)) if raw_segments else 0
    logger.info(f"Raw diarization: {segments_before} segments, {unique_before} speakers")

    # ── Step A: Filter noise segments (< MIN_SEGMENT_DURATION) ──
    filtered = filter_noise_segments(raw_segments)
    segments_after_filter = len(filtered)
    logger.info(f"After noise filtering (<{MIN_SEGMENT_DURATION}s): "
                f"{segments_before} → {segments_after_filter} segments "
                f"(removed {segments_before - segments_after_filter})")

    # ── Step B: Merge adjacent same-speaker segments with small gaps ──
    merged = merge_adjacent_segments(filtered)
    segments_after_merge = len(merged)
    logger.info(f"After same-speaker merging (<{SAME_SPEAKER_MERGE_GAP}s gap): "
                f"{segments_after_filter} → {segments_after_merge} segments")

    unique_after = len(set(s['speaker'] for s in merged)) if merged else 0
    logger.info(f"Diarization complete: {segments_after_merge} segments, "
                f"{unique_after} speakers")

    metrics = {
        "segmentsBeforeFilter": segments_before,
        "segmentsAfterFilter": segments_after_filter,
        "segmentsAfterMerge": segments_after_merge,
        "clusteringThreshold": clustering_threshold or DEFAULT_CLUSTERING_THRESHOLD,
    }

    return merged, metrics


def filter_noise_segments(segments: list[dict]) -> list[dict]:
    """
    Remove noise segments shorter than MIN_SEGMENT_DURATION.
    These are typically classification artifacts from brief audio events
    (coughs, clicks, mic noise) that get wrongly labeled as speech.
    """
    return [
        seg for seg in segments
        if (seg["end"] - seg["start"]) >= MIN_SEGMENT_DURATION
    ]


def merge_adjacent_segments(segments: list[dict]) -> list[dict]:
    """
    Merge adjacent segments from the same speaker when the gap between
    them is smaller than SAME_SPEAKER_MERGE_GAP. This prevents
    over-fragmentation where a brief pause in speech creates two segments.
    """
    if not segments:
        return []

    merged = [segments[0].copy()]

    for seg in segments[1:]:
        prev = merged[-1]
        gap = seg["start"] - prev["end"]

        if seg["speaker"] == prev["speaker"] and gap <= SAME_SPEAKER_MERGE_GAP:
            # Extend the previous segment to cover this one
            prev["end"] = max(prev["end"], seg["end"])
        else:
            merged.append(seg.copy())

    return merged


def run_whisper_transcription(
    wav_path: str, language: Optional[str] = None
) -> dict:
    """
    Run Whisper with word-level timestamps.
    Returns { text, language, segments: [{ start, end, text }], words: [{ word, start, end }] }
    """
    model = get_whisper_model()

    logger.info(f"Running Whisper transcription (language={language or 'auto'})…")
    result = model.transcribe(
        wav_path,
        language=language,
        word_timestamps=True,
        verbose=False,
        condition_on_previous_text=True,
        fp16=(DEVICE == "cuda"),
    )

    # Extract word-level timestamps
    words = []
    for segment in result.get("segments", []):
        for w in segment.get("words", []):
            words.append({
                "word": w["word"].strip(),
                "start": round(w["start"], 3),
                "end": round(w["end"], 3),
                "probability": round(w.get("probability", 0.0), 4),
            })

    logger.info(f"Whisper complete: {len(words)} words, "
                f"language={result.get('language', 'unknown')}")

    return {
        "text": result["text"].strip(),
        "language": result.get("language", "en"),
        "segments": [
            {
                "start": s["start"],
                "end": s["end"],
                "text": s["text"].strip(),
            }
            for s in result.get("segments", [])
        ],
        "words": words,
    }


def align_words_to_speakers(
    diarization_segments: list[dict],
    whisper_words: list[dict],
) -> list[TranscriptWord]:
    """
    Enterprise word-to-speaker alignment using a weighted scoring system.

    For each word, we compute a score for every diarization segment:
      score = overlap_weight * overlap
            + proximity_weight * (1 / (1 + distance_to_midpoint))
            + continuity_weight * (1 if same speaker as previous word else 0)

    This produces more accurate attribution than pure overlap matching,
    especially for:
      - Short words that fall in gaps between segments
      - Words at speaker turn boundaries
      - Rapid back-and-forth dialogue
    """
    if not diarization_segments or not whisper_words:
        return []

    # Scoring weights
    OVERLAP_WEIGHT = 0.6
    PROXIMITY_WEIGHT = 0.25
    CONTINUITY_WEIGHT = 0.15  # bias toward keeping same speaker (reduces flicker)

    attributed_words = []
    prev_speaker = diarization_segments[0]["speaker"]

    for w in whisper_words:
        w_start = w["start"]
        w_end = w["end"]
        w_mid = (w_start + w_end) / 2.0
        w_duration = max(w_end - w_start, 0.001)

        best_speaker = "Unknown"
        best_score = -1.0

        for seg in diarization_segments:
            # Overlap component (normalized to word duration)
            overlap_start = max(w_start, seg["start"])
            overlap_end = min(w_end, seg["end"])
            overlap = max(0.0, overlap_end - overlap_start) / w_duration

            # Proximity component (inverse distance from word midpoint to segment)
            seg_mid = (seg["start"] + seg["end"]) / 2.0
            distance = abs(w_mid - seg_mid)
            proximity = 1.0 / (1.0 + distance)

            # Continuity component (bias toward previous speaker)
            continuity = 1.0 if seg["speaker"] == prev_speaker else 0.0

            score = (
                OVERLAP_WEIGHT * overlap
                + PROXIMITY_WEIGHT * proximity
                + CONTINUITY_WEIGHT * continuity
            )

            if score > best_score:
                best_score = score
                best_speaker = seg["speaker"]

        prev_speaker = best_speaker

        attributed_words.append(
            TranscriptWord(
                word=w["word"],
                start=w["start"],
                end=w["end"],
                speaker=best_speaker,
                confidence=w.get("probability", 0.0),
            )
        )

    return attributed_words


def build_transcript_blocks(
    attributed_words: list[TranscriptWord],
) -> tuple[list[TranscriptBlock], int]:
    """
    Merge consecutive words from the same speaker into contiguous blocks,
    then apply smoothing to remove single-word speaker flickers.

    Returns (blocks, smoothed_count) where smoothed_count is the number
    of micro-blocks that were absorbed by smoothing.
    """
    if not attributed_words:
        return [], 0

    blocks: list[TranscriptBlock] = []
    current_speaker = attributed_words[0].speaker
    current_words: list[TranscriptWord] = [attributed_words[0]]

    for word in attributed_words[1:]:
        if word.speaker == current_speaker:
            current_words.append(word)
        else:
            # Finalize current block
            blocks.append(_finalize_block(current_speaker, current_words))
            current_speaker = word.speaker
            current_words = [word]

    # Finalize last block
    if current_words:
        blocks.append(_finalize_block(current_speaker, current_words))

    blocks_before_smoothing = len(blocks)

    # ── Post-processing: Smooth out single-word speaker flickers ──
    # A "flicker" is a tiny block (< MIN_BLOCK_WORDS) sandwiched between
    # two blocks from the same speaker. E.g.: [A A A] [B] [A A A] → [A A A A A A A]
    # This is almost always a mis-attribution, not a real speaker change.
    blocks = smooth_speaker_flickers(blocks)
    smoothed_count = blocks_before_smoothing - len(blocks)

    if smoothed_count > 0:
        logger.info(f"Smoothing: absorbed {smoothed_count} micro-blocks "
                    f"({blocks_before_smoothing} → {len(blocks)})")

    # Relabel speakers to friendly names (Speaker 1, Speaker 2, …)
    # Use speaking-time order: the speaker with the most total words gets Speaker 1
    speaker_word_counts: Counter = Counter()
    for block in blocks:
        speaker_word_counts[block.speaker] += block.wordCount

    # Sort by total word count descending → Speaker 1 = most active
    ranked_speakers = [s for s, _ in speaker_word_counts.most_common()]
    speaker_map: dict[str, str] = {}
    for i, spk in enumerate(ranked_speakers, start=1):
        speaker_map[spk] = f"Speaker {i}"

    for block in blocks:
        block.speaker = speaker_map.get(block.speaker, block.speaker)

    logger.info(f"Built {len(blocks)} transcript blocks from "
                f"{len(attributed_words)} words "
                f"({len(speaker_map)} speakers)")
    return blocks, smoothed_count


def smooth_speaker_flickers(
    blocks: list[TranscriptBlock],
) -> list[TranscriptBlock]:
    """
    Remove speaker flickers: tiny blocks (< MIN_BLOCK_WORDS words)
    sandwiched between blocks from the same speaker.

    E.g. [Speaker A: 30 words] [Speaker B: 1 word] [Speaker A: 25 words]
    → The 1-word block from B is almost certainly a misattribution.
       Absorb it into Speaker A's surrounding blocks.
    """
    if len(blocks) < 3:
        return blocks

    smoothed: list[TranscriptBlock] = [blocks[0]]

    i = 1
    while i < len(blocks) - 1:
        prev = smoothed[-1]
        curr = blocks[i]
        next_blk = blocks[i + 1]

        # Is this a flicker? Small block surrounded by same speaker
        if (
            curr.wordCount < MIN_BLOCK_WORDS
            and prev.speaker == next_blk.speaker
            and prev.speaker != curr.speaker
        ):
            # Absorb: extend prev block to include curr's content
            merged_content = prev.content + " " + curr.content
            merged_words = prev.wordCount + curr.wordCount
            avg_conf = (
                (prev.confidence * prev.wordCount + curr.confidence * curr.wordCount)
                / merged_words
            )
            smoothed[-1] = TranscriptBlock(
                speaker=prev.speaker,
                content=merged_content,
                startTime=prev.startTime,
                endTime=curr.endTime,
                confidence=round(avg_conf, 4),
                wordCount=merged_words,
            )
            i += 1  # skip absorbed block
        else:
            smoothed.append(curr)
            i += 1

    # Don't forget the last block
    if i < len(blocks):
        # Possibly merge with the last smoothed block if same speaker
        last = blocks[-1]
        if smoothed and smoothed[-1].speaker == last.speaker:
            prev = smoothed[-1]
            merged_content = prev.content + " " + last.content
            merged_words = prev.wordCount + last.wordCount
            avg_conf = (
                (prev.confidence * prev.wordCount + last.confidence * last.wordCount)
                / merged_words
            )
            smoothed[-1] = TranscriptBlock(
                speaker=prev.speaker,
                content=merged_content,
                startTime=prev.startTime,
                endTime=last.endTime,
                confidence=round(avg_conf, 4),
                wordCount=merged_words,
            )
        else:
            smoothed.append(last)

    return smoothed


def _finalize_block(speaker: str, words: list[TranscriptWord]) -> TranscriptBlock:
    """Create a TranscriptBlock from a list of consecutive same-speaker words."""
    content = " ".join(w.word for w in words)
    avg_confidence = sum(w.confidence for w in words) / len(words) if words else 0.0

    return TranscriptBlock(
        speaker=speaker,
        content=content,
        startTime=words[0].start,
        endTime=words[-1].end,
        confidence=round(avg_confidence, 4),
        wordCount=len(words),
    )


# ──────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────

@app.get("/")
async def root():
    """Root endpoint for Render port detection."""
    return {"status": "ok", "service": "dashmet-diarization"}


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        device=DEVICE,
        whisperModel=WHISPER_MODEL_SIZE,
        pyannoteLoaded=_diarization_pipeline is not None,
        whisperLoaded=_whisper_model is not None,
        clusteringThreshold=DEFAULT_CLUSTERING_THRESHOLD,
        minSegmentDuration=MIN_SEGMENT_DURATION,
        sameSpkMergeGap=SAME_SPEAKER_MERGE_GAP,
    )


@app.post("/diarize", response_model=JobSubmitResponse)
async def diarize_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    num_speakers: Optional[int] = Form(None),
    min_speakers: Optional[int] = Form(None),
    max_speakers: Optional[int] = Form(None),
    clustering_threshold: Optional[float] = Form(None),
):
    """
    Submit audio for background speaker diarization.
    Returns a job ID immediately — poll GET /jobs/{jobId} for results.
    """
    # Read uploaded audio into memory
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    filename = audio.filename or "audio.m4a"
    logger.info(f"Received audio: {filename} | {len(audio_bytes)} bytes")

    # Create job
    job_id = str(uuid.uuid4())
    with _job_lock:
        _job_store[job_id] = {
            "status": "processing",
            "progress": "Queued for processing",
            "result": None,
        }

    # Submit to background thread
    _executor.submit(
        _process_diarization_job,
        job_id, audio_bytes, filename,
        language, num_speakers, min_speakers, max_speakers,
        clustering_threshold,
    )

    return JobSubmitResponse(jobId=job_id, status="processing")


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Poll this endpoint to check diarization job progress and retrieve results."""
    job = _get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        jobId=job_id,
        status=job["status"],
        progress=job.get("progress"),
        result=job.get("result"),
    )


def _process_diarization_job(
    job_id: str,
    audio_bytes: bytes,
    filename: str,
    language: Optional[str],
    num_speakers: Optional[int],
    min_speakers: Optional[int],
    max_speakers: Optional[int],
    clustering_threshold: Optional[float],
):
    """
    Background worker: runs the full 7-stage diarization pipeline.
    Updates job store with progress and final result.
    """
    start_time = time.time()
    wav_path = None

    try:
        _update_job(job_id, progress="Converting audio to WAV")

        # Step 1: Convert to WAV
        wav_path = convert_to_wav(audio_bytes, filename)

        # Step 2+3+4: Run Pyannote diarization with filtering & merging
        _update_job(job_id, progress="Running speaker diarization (Pyannote)")
        diarization_segments, diar_metrics = run_diarization(
            wav_path,
            num_speakers=num_speakers,
            min_speakers=min_speakers,
            max_speakers=max_speakers,
            clustering_threshold=clustering_threshold,
        )

        if not diarization_segments:
            elapsed = round(time.time() - start_time, 2)
            _update_job(job_id, status="failed", progress="No speech detected",
                        result=DiarizationResponse(
                            success=False, blocks=[], speakers=[], speakerCount=0,
                            totalDuration=0.0, totalWords=0, language="en",
                            processingTimeSeconds=elapsed,
                            error="No speech detected in audio",
                        ).model_dump())
            return

        # Step 5: Run Whisper with word timestamps
        _update_job(job_id, progress="Transcribing audio (Whisper)")
        whisper_result = run_whisper_transcription(wav_path, language=language)

        if not whisper_result.get("words"):
            logger.warning("No word-level timestamps from Whisper, "
                           "falling back to segment alignment")
            whisper_words = []
            for seg in whisper_result.get("segments", []):
                words_in_seg = seg["text"].strip().split()
                if not words_in_seg:
                    continue
                duration = seg["end"] - seg["start"]
                per_word = duration / len(words_in_seg)
                for i, word in enumerate(words_in_seg):
                    whisper_words.append({
                        "word": word,
                        "start": round(seg["start"] + i * per_word, 3),
                        "end": round(seg["start"] + (i + 1) * per_word, 3),
                        "probability": 0.8,
                    })
            whisper_result["words"] = whisper_words

        # Step 6: Weighted alignment of words to speakers
        _update_job(job_id, progress="Aligning words to speakers")
        attributed_words = align_words_to_speakers(
            diarization_segments, whisper_result["words"]
        )

        # Step 7: Build transcript blocks with smoothing
        _update_job(job_id, progress="Building transcript blocks")
        blocks, smoothed_count = build_transcript_blocks(attributed_words)

        # Compute stats
        all_speakers = sorted(set(b.speaker for b in blocks))
        total_duration = max(
            (b.endTime for b in blocks), default=0.0
        )
        total_words = sum(b.wordCount for b in blocks)
        elapsed = round(time.time() - start_time, 2)

        # Compute quality metrics
        avg_confidence = (
            sum(b.confidence * b.wordCount for b in blocks) / total_words
            if total_words > 0 else 0.0
        )
        speech_coverage = (
            sum(seg["end"] - seg["start"] for seg in diarization_segments)
            / total_duration * 100.0
            if total_duration > 0 else 0.0
        )

        quality = QualityMetrics(
            avgConfidence=round(avg_confidence, 4),
            diarizationCoverage=round(min(speech_coverage, 100.0), 1),
            segmentsBeforeFilter=diar_metrics["segmentsBeforeFilter"],
            segmentsAfterFilter=diar_metrics["segmentsAfterFilter"],
            segmentsAfterMerge=diar_metrics["segmentsAfterMerge"],
            smoothedBlocks=smoothed_count,
            clusteringThreshold=diar_metrics["clusteringThreshold"],
        )

        result = DiarizationResponse(
            success=True,
            blocks=blocks,
            speakers=all_speakers,
            speakerCount=len(all_speakers),
            totalDuration=round(total_duration, 2),
            totalWords=total_words,
            language=whisper_result.get("language", "en"),
            processingTimeSeconds=elapsed,
            qualityMetrics=quality,
        )

        logger.info(
            f"Diarization complete: {len(blocks)} blocks, "
            f"{len(all_speakers)} speakers, {total_words} words, "
            f"{elapsed}s processing | confidence={avg_confidence:.3f} "
            f"coverage={speech_coverage:.1f}%"
        )

        _update_job(job_id, status="complete", progress="Done",
                     result=result.model_dump())

    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        logger.exception(f"Diarization job {job_id} failed after {elapsed}s")
        _update_job(job_id, status="failed", progress=f"Error: {str(e)}",
                     result=DiarizationResponse(
                         success=False, blocks=[], speakers=[], speakerCount=0,
                         totalDuration=0.0, totalWords=0, language="en",
                         processingTimeSeconds=elapsed, error=str(e),
                     ).model_dump())
    finally:
        if wav_path and os.path.exists(wav_path):
            try:
                os.unlink(wav_path)
            except Exception:
                pass


# ──────────────────────────────────────────────────────────
# Startup
# ──────────────────────────────────────────────────────────

@app.on_event("startup")
async def warmup_models():
    """
    Pre-load models on startup so first request is fast.
    Set PRELOAD_MODELS=true to enable.
    """
    if os.getenv("PRELOAD_MODELS", "false").lower() == "true":
        logger.info("Pre-loading models…")
        try:
            get_diarization_pipeline()
            get_whisper_model()
            logger.info("Models pre-loaded successfully")
        except Exception as e:
            logger.error(f"Failed to pre-load models: {e}")
    else:
        logger.info("Models will be loaded on first request "
                     "(set PRELOAD_MODELS=true to pre-load)")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", os.getenv("DIARIZATION_PORT", "10000")))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,  # Single worker — models are not fork-safe
    )
