"""
Enterprise Speaker Diarization Service
=======================================
FastAPI microservice combining Pyannote Audio speaker diarization
with OpenAI Whisper word-level transcription for enterprise-grade
meeting transcript generation with per-speaker timestamps.

Architecture:
  1. Pyannote Pipeline  → WHO spoke WHEN (speaker segments)
  2. Whisper (local)     → WHAT was said with word-level timestamps
  3. Alignment Engine    → Merge diarization + transcription into
                           speaker-attributed, timestamped transcript blocks

Author: Dashmet Meeting Intelligence
"""

import os
import io
import tempfile
import logging
import time
from pathlib import Path
from typing import Optional

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


def get_diarization_pipeline():
    """Lazy-load Pyannote speaker diarization pipeline."""
    global _diarization_pipeline
    if _diarization_pipeline is None:
        logger.info("Loading Pyannote speaker diarization pipeline…")
        from pyannote.audio import Pipeline

        _diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=HF_AUTH_TOKEN,
        )
        if DEVICE == "cuda":
            _diarization_pipeline.to(torch.device("cuda"))
        logger.info(f"Pyannote pipeline loaded on {DEVICE}")
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


class HealthResponse(BaseModel):
    status: str
    device: str
    whisperModel: str
    pyannoteLoaded: bool
    whisperLoaded: bool


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


def run_diarization(wav_path: str, num_speakers: Optional[int] = None) -> list[dict]:
    """
    Run Pyannote speaker diarization.
    Returns list of segments: [{ speaker, start, end }]
    """
    pipeline = get_diarization_pipeline()

    logger.info("Running speaker diarization…")
    kwargs = {}
    if num_speakers is not None and num_speakers > 0:
        kwargs["num_speakers"] = num_speakers

    diarization_result = pipeline(wav_path, **kwargs)

    segments = []
    for turn, _, speaker in diarization_result.itertracks(yield_label=True):
        segments.append({
            "speaker": speaker,
            "start": round(turn.start, 3),
            "end": round(turn.end, 3),
        })

    logger.info(f"Diarization complete: {len(segments)} segments, "
                f"{len(set(s['speaker'] for s in segments))} speakers")
    return segments


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
    Map each Whisper word to the Pyannote speaker whose segment
    overlaps most with the word's time span.
    """
    attributed_words = []

    for w in whisper_words:
        w_start = w["start"]
        w_end = w["end"]
        w_mid = (w_start + w_end) / 2.0

        best_speaker = "Unknown"
        best_overlap = 0.0

        for seg in diarization_segments:
            overlap_start = max(w_start, seg["start"])
            overlap_end = min(w_end, seg["end"])
            overlap = max(0.0, overlap_end - overlap_start)

            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = seg["speaker"]

        # Fallback: if no overlap, find nearest segment by midpoint
        if best_overlap == 0.0:
            min_dist = float("inf")
            for seg in diarization_segments:
                seg_mid = (seg["start"] + seg["end"]) / 2.0
                dist = abs(w_mid - seg_mid)
                if dist < min_dist:
                    min_dist = dist
                    best_speaker = seg["speaker"]

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
) -> list[TranscriptBlock]:
    """
    Merge consecutive words from the same speaker into contiguous blocks.
    Each block = one speaker's uninterrupted speech with timestamps.
    """
    if not attributed_words:
        return []

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

    # Relabel speakers to friendly names (Speaker 1, Speaker 2, …)
    speaker_map: dict[str, str] = {}
    counter = 1
    for block in blocks:
        if block.speaker not in speaker_map:
            speaker_map[block.speaker] = f"Speaker {counter}"
            counter += 1
        block.speaker = speaker_map[block.speaker]

    logger.info(f"Built {len(blocks)} transcript blocks from "
                f"{len(attributed_words)} words")
    return blocks


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

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        device=DEVICE,
        whisperModel=WHISPER_MODEL_SIZE,
        pyannoteLoaded=_diarization_pipeline is not None,
        whisperLoaded=_whisper_model is not None,
    )


@app.post("/diarize", response_model=DiarizationResponse)
async def diarize_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    num_speakers: Optional[int] = Form(None),
):
    """
    Enterprise Speaker Diarization Endpoint
    ─────────────────────────────────────────
    Upload an audio file to receive a fully diarized, timestamped
    transcript with speaker attribution.

    Pipeline:
      1. Audio normalization → 16kHz mono WAV
      2. Pyannote speaker diarization → who spoke when
      3. OpenAI Whisper transcription → word-level timestamps
      4. Temporal alignment → map each word to its speaker
      5. Block assembly → contiguous speaker blocks with timestamps
    """
    start_time = time.time()
    wav_path = None

    try:
        # Read uploaded audio
        audio_bytes = await audio.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        logger.info(f"Received audio: {audio.filename} | {len(audio_bytes)} bytes")

        # Step 1: Convert to WAV
        wav_path = convert_to_wav(audio_bytes, audio.filename or "audio.m4a")

        # Step 2: Run Pyannote diarization
        diarization_segments = run_diarization(wav_path, num_speakers=num_speakers)

        if not diarization_segments:
            raise HTTPException(
                status_code=422,
                detail="No speech detected in audio"
            )

        # Step 3: Run Whisper with word timestamps
        whisper_result = run_whisper_transcription(wav_path, language=language)

        if not whisper_result.get("words"):
            # Fallback: use segment-level timestamps if no word timestamps
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

        # Step 4: Align words to speakers
        attributed_words = align_words_to_speakers(
            diarization_segments, whisper_result["words"]
        )

        # Step 5: Build transcript blocks
        blocks = build_transcript_blocks(attributed_words)

        # Compute stats
        all_speakers = sorted(set(b.speaker for b in blocks))
        total_duration = max(
            (b.endTime for b in blocks), default=0.0
        )
        total_words = sum(b.wordCount for b in blocks)
        elapsed = round(time.time() - start_time, 2)

        logger.info(
            f"Diarization complete: {len(blocks)} blocks, "
            f"{len(all_speakers)} speakers, {total_words} words, "
            f"{elapsed}s processing time"
        )

        return DiarizationResponse(
            success=True,
            blocks=blocks,
            speakers=all_speakers,
            speakerCount=len(all_speakers),
            totalDuration=round(total_duration, 2),
            totalWords=total_words,
            language=whisper_result.get("language", "en"),
            processingTimeSeconds=elapsed,
        )

    except HTTPException:
        raise
    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        logger.exception(f"Diarization failed after {elapsed}s")
        return DiarizationResponse(
            success=False,
            blocks=[],
            speakers=[],
            speakerCount=0,
            totalDuration=0.0,
            totalWords=0,
            language="en",
            processingTimeSeconds=elapsed,
            error=str(e),
        )
    finally:
        # Cleanup temp WAV
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

    port = int(os.getenv("DIARIZATION_PORT", "8100"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,  # Single worker — models are not fork-safe
    )
