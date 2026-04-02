'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Upload,
  FileAudio,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mic,
  Clock,
  FileText,
  Sparkles,
} from 'lucide-react';

const meetingTypes = [
  { value: 'GENERAL', label: 'General Meeting' },
  { value: 'STANDUP', label: 'Standup' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'RETROSPECTIVE', label: 'Retrospective' },
  { value: 'ONE_ON_ONE', label: '1:1 Meeting' },
  { value: 'BRAINSTORM', label: 'Brainstorm' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'CLIENT', label: 'Client Meeting' },
  { value: 'INCIDENT_REVIEW', label: 'Incident Review' },
  { value: 'SAFETY_BRIEFING', label: 'Safety Briefing' },
];

const supportedFormats = ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'ogg', 'flac', 'aac'];

type UploadStep = 'select' | 'details' | 'uploading' | 'transcribing' | 'complete' | 'error';

function UploadContent() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('GENERAL');
  const [objective, setObjective] = useState('');
  const [generateSummary, setGenerateSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && isValidAudioFile(droppedFile)) {
      setFile(droppedFile);
      setStep('details');
    } else {
      setError('Please upload a valid audio file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidAudioFile(selectedFile)) {
      setFile(selectedFile);
      setStep('details');
      setError(null);
    } else {
      setError('Please upload a valid audio file');
    }
  };

  const isValidAudioFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext ? supportedFormats.includes(ext) : false;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    
    setStep('uploading');
    setError(null);
    setProgress(0);
    
    try {
      // Step 1: Create meeting record
      const meetingTitle = title.trim() || `Imported Recording - ${new Date().toLocaleDateString()}`;
      
      const createResponse = await api.post('/mobile/meetings', {
        title: meetingTitle,
        meetingType,
        objective: objective.trim() || null,
        creatorId: user.id,
        organizationId: user.organizationId,
        facilityId: user.facilityId,
      });
      
      if (!createResponse.data.success) {
        throw new Error(createResponse.data.error || 'Failed to create meeting');
      }
      
      const meeting = createResponse.data.meeting;
      setMeetingId(meeting.id);
      setProgress(20);
      
      // Step 2: Upload audio file for transcription
      setStep('transcribing');
      
      const formData = new FormData();
      formData.append('audio', file);
      
      const transcribeResponse = await api.post('/transcripts/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 600000, // 10 minutes for long recordings
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setProgress(20 + Math.floor(percentCompleted * 0.3)); // 20-50%
        },
      });
      
      if (!transcribeResponse.data?.transcript) {
        throw new Error('Transcription failed');
      }
      
      const transcript = transcribeResponse.data.transcript;
      setProgress(60);
      
      // Step 3: Save processed transcript
      await api.post('/transcripts/save-processed', {
        meetingId: meeting.id,
        transcript,
      });
      setProgress(70);
      
      // Step 4: Update meeting status
      await api.patch(`/mobile/meetings/${meeting.id}`, {
        status: 'COMPLETED',
        rawTranscript: transcript,
        hasTranscript: true,
      });
      setProgress(80);
      
      // Step 5: Generate AI summary if requested
      if (generateSummary) {
        try {
          const summaryResponse = await api.post('/transcripts/narrative-summary', {
            transcript,
            meetingId: meeting.id,
            meetingType,
            title: meetingTitle,
          });
          
          if (summaryResponse.data?.summary) {
            await api.post('/transcripts/save-ai-summary', {
              meetingId: meeting.id,
              summary: summaryResponse.data.summary,
              keyPoints: summaryResponse.data.keyPoints || [],
              actionItems: summaryResponse.data.actionItems || [],
              decisions: summaryResponse.data.decisions || [],
              nextSteps: summaryResponse.data.nextSteps || [],
            });
            
            await api.patch(`/mobile/meetings/${meeting.id}`, {
              hasAISummary: true,
            });
          }
        } catch (summaryError) {
          console.error('Summary generation failed:', summaryError);
          // Don't fail the whole process if summary fails
        }
      }
      
      setProgress(100);
      setStep('complete');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setStep('error');
    }
  };

  const resetUpload = () => {
    setStep('select');
    setFile(null);
    setTitle('');
    setObjective('');
    setMeetingType('GENERAL');
    setError(null);
    setMeetingId(null);
    setProgress(0);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Upload Recording
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload an audio recording to transcribe and analyze
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === 'select' && (
          <div
            className={`relative bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border-2 border-dashed transition-colors ${
              dragActive
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="p-12 text-center">
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full w-fit mx-auto mb-4">
                <Upload className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Drop your audio file here
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                or click to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all"
              >
                <FileAudio className="w-5 h-5" />
                <span>Select Audio File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={supportedFormats.map((f) => `.${f}`).join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                Supported formats: {supportedFormats.join(', ')} • Max size: 500MB
              </p>
            </div>
          </div>
        )}

        {step === 'details' && file && (
          <div className="space-y-6">
            {/* File Info */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <FileAudio className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={resetUpload}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Meeting Details Form */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Meeting Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Weekly Team Sync"
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meeting Type
                </label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {meetingTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Objective (optional)
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="What was this meeting about?"
                  rows={3}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              
              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="generateSummary"
                  checked={generateSummary}
                  onChange={(e) => setGenerateSummary(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="generateSummary" className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Generate AI Summary after transcription</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={resetUpload}
                className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Upload & Transcribe</span>
              </button>
            </div>
          </div>
        )}

        {(step === 'uploading' || step === 'transcribing') && (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-8 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
              <div
                className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"
                style={{
                  clipPath: `polygon(0 0, ${progress}% 0, ${progress}% 100%, 0 100%)`,
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {step === 'uploading' ? (
                  <Upload className="w-8 h-8 text-purple-600" />
                ) : (
                  <FileText className="w-8 h-8 text-purple-600" />
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {step === 'uploading' ? 'Uploading...' : 'Transcribing...'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {step === 'uploading'
                ? 'Uploading your audio file to the server'
                : 'Converting speech to text using AI'}
            </p>
            
            {/* Progress bar */}
            <div className="w-full max-w-xs mx-auto">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{progress}%</p>
            </div>
            
            {step === 'transcribing' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                This may take several minutes for longer recordings
              </p>
            )}
          </div>
        )}

        {step === 'complete' && (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-8 text-center">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full w-fit mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Upload Complete!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Your recording has been transcribed and is ready to view.
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={resetUpload}
                className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Upload Another
              </button>
              <Link
                href={meetingId ? `/meetings/${meetingId}` : '/meetings'}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all"
              >
                <span>View Meeting</span>
              </Link>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-red-200 dark:border-red-900/50 p-8 text-center">
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto mb-4">
              <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Upload Failed
            </h3>
            <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={resetUpload}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all"
              >
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}

        {/* Features Info */}
        {step === 'select' && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm rounded-xl p-4 text-center">
              <Mic className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900 dark:text-white">AI Transcription</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Accurate speech-to-text using Whisper AI
              </p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm rounded-xl p-4 text-center">
              <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900 dark:text-white">Smart Summary</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-generated key points and action items
              </p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm rounded-xl p-4 text-center">
              <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900 dark:text-white">Long Recordings</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Support for meetings up to 60+ minutes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <UploadContent />
    </ProtectedRoute>
  );
}
