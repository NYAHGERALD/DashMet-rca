'use client';

import React from 'react';

interface SubmittedIncidentData {
  id: string;
  incidentNumber: string;
  title: string;
  type: string;
  category?: string;
  severity: string;
  status: string;
  date: string;
  time: string;
  facility?: string;
  area?: string;
  line?: string;
  shift?: string;
  description: string;
  aiSummary?: string;
  attachmentCount: number;
  visibility?: string;
  recommendedRCAMethodology?: {
    primary: string;
    reason: string;
    confidence: number;
    alternativeMethod?: string;
    alternativeReason?: string;
  } | null;
}

interface IncidentSubmissionModalProps {
  isOpen: boolean;
  incidentData: SubmittedIncidentData | null;
  onViewIncident: () => void;
  onGoToDashboard: () => void;
}

const IncidentSubmissionModal: React.FC<IncidentSubmissionModalProps> = ({
  isOpen,
  incidentData,
  onViewIncident,
  onGoToDashboard,
}) => {
  if (!isOpen || !incidentData) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'WORKPLACE_SAFETY': return '🦺';
      case 'SECURITY': return '🔒';
      case 'ENVIRONMENTAL': return '🌿';
      case 'QUALITY': return '✓';
      case 'EQUIPMENT': return '⚙️';
      case 'PROCESS': return '🔄';
      case 'BEHAVIORAL': return '👥';
      default: return '📋';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop with confetti-like animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/90 via-emerald-900/90 to-teal-900/90 backdrop-blur-sm">
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#FBBF24', '#FCD34D'][i % 6],
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl transform animate-modal-enter max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-6 text-center relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,white_25%,white_50%,transparent_50%,transparent_75%,white_75%)] bg-[length:20px_20px] animate-slide-pattern" />
          </div>
          
          {/* Success icon with animation */}
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce-once">
              <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={3} 
                  d="M5 13l4 4L19 7"
                  className="animate-draw-check"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Incident Submitted Successfully!</h2>
            <p className="text-green-100 text-lg">
              Your incident report has been recorded and is ready for review
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Incident Summary Card */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-xl p-6 mb-6 border border-slate-200 dark:border-slate-600">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getTypeIcon(incidentData.type)}</span>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {incidentData.incidentNumber}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {incidentData.type?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-bold border ${getSeverityColor(incidentData.severity)}`}>
                {incidentData.severity}
              </span>
            </div>

            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {incidentData.title}
            </h4>
            
            <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
              {incidentData.description}
            </p>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-600">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Date</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {formatDate(incidentData.date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Time</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {formatTime(incidentData.time)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Status</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {incidentData.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Attachments</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {incidentData.attachmentCount} file{incidentData.attachmentCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Location & Category Info */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Location Card */}
            <div className="bg-white dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <span className="text-lg">📍</span> Location Details
              </h5>
              <div className="space-y-2">
                {incidentData.facility && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Facility:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{incidentData.facility}</span>
                  </div>
                )}
                {incidentData.area && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Area:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{incidentData.area}</span>
                  </div>
                )}
                {incidentData.line && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Line:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{incidentData.line}</span>
                  </div>
                )}
                {incidentData.shift && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Shift:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{incidentData.shift}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Category & Visibility Card */}
            <div className="bg-white dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <span className="text-lg">📁</span> Classification
              </h5>
              <div className="space-y-2">
                {incidentData.category && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Category:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{incidentData.category}</span>
                  </div>
                )}
                {incidentData.visibility && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Visibility:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium capitalize">{incidentData.visibility?.toLowerCase()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Summary Card */}
          {incidentData.aiSummary && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-5 mb-6 border border-indigo-200 dark:border-indigo-800">
              <h5 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-2">
                <span className="text-lg">🤖</span> AI-Generated Summary
              </h5>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {incidentData.aiSummary}
              </p>
            </div>
          )}

          {/* RCA Methodology Recommendation */}
          {incidentData.recommendedRCAMethodology && (
            <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20 rounded-xl p-5 mb-6 border border-violet-200 dark:border-violet-800">
              <h5 className="text-sm font-semibold text-violet-800 dark:text-violet-300 mb-3 flex items-center gap-2">
                <span className="text-lg">🔍</span> Recommended RCA Methodology
              </h5>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">
                  {incidentData.recommendedRCAMethodology.primary === 'FIVE_WHYS' ? '5️⃣' : '🐟'}
                </span>
                <div>
                  <p className="font-bold text-violet-900 dark:text-violet-200">
                    {incidentData.recommendedRCAMethodology.primary === 'FIVE_WHYS' 
                      ? '5 Whys Analysis' 
                      : 'Fishbone (Ishikawa) Diagram'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    incidentData.recommendedRCAMethodology.confidence >= 80 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : incidentData.recommendedRCAMethodology.confidence >= 50
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {incidentData.recommendedRCAMethodology.confidence}% confidence
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {incidentData.recommendedRCAMethodology.reason}
              </p>
            </div>
          )}

          {/* Next Steps Info */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
              <span className="text-lg">💡</span> What Happens Next?
            </h5>
            <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <li>• Your incident has been logged and assigned number <strong>{incidentData.incidentNumber}</strong></li>
              <li>• A notification will be sent to relevant stakeholders</li>
              <li>• You can start the Root Cause Analysis from the incident details page</li>
              <li>• Track progress and add comments anytime</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onViewIncident}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Incident Details
            </button>
            <button
              onClick={onGoToDashboard}
              className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow hover:shadow-md transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
        }
        @keyframes modal-enter {
          0% { transform: scale(0.9) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes slide-pattern {
          0% { transform: translateX(0); }
          100% { transform: translateX(20px); }
        }
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes draw-check {
          0% { stroke-dasharray: 100; stroke-dashoffset: 100; }
          100% { stroke-dasharray: 100; stroke-dashoffset: 0; }
        }
        .animate-float {
          animation: float ease-in-out infinite;
        }
        .animate-modal-enter {
          animation: modal-enter 0.4s ease-out forwards;
        }
        .animate-slide-pattern {
          animation: slide-pattern 1s linear infinite;
        }
        .animate-bounce-once {
          animation: bounce-once 0.6s ease-out;
        }
        .animate-draw-check {
          animation: draw-check 0.6s ease-out forwards;
          animation-delay: 0.2s;
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
        }
      `}</style>
    </div>
  );
};

export default IncidentSubmissionModal;
