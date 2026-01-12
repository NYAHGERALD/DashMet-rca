'use client';

import { useEffect, useState } from 'react';

interface AIAnalysisModalProps {
  isOpen: boolean;
  stage: 'preparing' | 'uploading' | 'analyzing' | 'generating' | 'finalizing' | 'complete';
  attachmentCount: number;
  currentAttachment?: number;
}

const stages = {
  preparing: {
    title: 'Preparing Analysis',
    description: 'Getting everything ready for AI analysis...',
    icon: '🔧',
    progress: 5,
  },
  uploading: {
    title: 'Processing Images',
    description: 'Converting your attachments for AI analysis...',
    icon: '📤',
    progress: 15,
  },
  analyzing: {
    title: 'Analyzing Evidence',
    description: 'Our AI is carefully examining each attachment...',
    icon: '🔍',
    progress: 45,
  },
  generating: {
    title: 'Generating Insights',
    description: 'Creating a comprehensive summary with key findings...',
    icon: '✨',
    progress: 75,
  },
  finalizing: {
    title: 'Recommending RCA Method',
    description: 'Determining the best analysis approach for this incident...',
    icon: '🎯',
    progress: 90,
  },
  complete: {
    title: 'Analysis Complete!',
    description: 'Your AI-powered summary is ready.',
    icon: '✅',
    progress: 100,
  },
};

const tips = [
  "💡 Tip: Clear, high-quality images help the AI provide better insights.",
  "💡 Did you know? The AI analyzes visual elements, text, and context clues.",
  "💡 Tip: Include images from multiple angles for comprehensive analysis.",
  "💡 The AI considers industry best practices when making recommendations.",
  "💡 Tip: Label your files descriptively for better evidence tracking.",
];

export default function AIAnalysisModal({ 
  isOpen, 
  stage, 
  attachmentCount,
  currentAttachment = 0 
}: AIAnalysisModalProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [dots, setDots] = useState('');
  
  const currentStage = stages[stage];

  // Rotate tips
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Animate dots
  useEffect(() => {
    if (!isOpen || stage === 'complete') return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen, stage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        {/* Animated gradient header */}
        <div className="h-2 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 animate-gradient-x" />
        
        {/* Content */}
        <div className="p-8">
          {/* Animated Icon */}
          <div className="flex justify-center mb-6">
            <div className={`text-6xl ${stage !== 'complete' ? 'animate-bounce-slow' : 'animate-pop'}`}>
              {currentStage.icon}
            </div>
          </div>
          
          {/* Title */}
          <h3 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-2">
            {currentStage.title}{stage !== 'complete' && dots}
          </h3>
          
          {/* Description */}
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            {currentStage.description}
          </p>
          
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Progress</span>
              <span>{currentStage.progress}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${currentStage.progress}%` }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>
          
          {/* Attachment counter */}
          {stage === 'analyzing' && attachmentCount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mb-6">
              <div className="flex items-center justify-center gap-3">
                <div className="flex -space-x-2">
                  {Array.from({ length: Math.min(attachmentCount, 5) }).map((_, i) => (
                    <div 
                      key={i}
                      className={`w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-bold ${
                        i < currentAttachment 
                          ? 'bg-green-500 text-white' 
                          : i === currentAttachment 
                            ? 'bg-blue-500 text-white animate-pulse' 
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {i < currentAttachment ? '✓' : i + 1}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Analyzing {currentAttachment} of {attachmentCount} files
                </span>
              </div>
            </div>
          )}
          
          {/* AI Processing Animation */}
          {stage !== 'complete' && (
            <div className="flex justify-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-wave" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-wave" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 rounded-full bg-cyan-500 animate-wave" style={{ animationDelay: '300ms' }} />
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-wave" style={{ animationDelay: '450ms' }} />
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-wave" style={{ animationDelay: '600ms' }} />
            </div>
          )}
          
          {/* Success checkmark animation */}
          {stage === 'complete' && (
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-pop">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={3} 
                    d="M5 13l4 4L19 7"
                    className="animate-draw-check"
                  />
                </svg>
              </div>
            </div>
          )}
          
          {/* Rotating tips */}
          {stage !== 'complete' && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 transition-all duration-500">
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center animate-fade-in" key={tipIndex}>
                {tips[tipIndex]}
              </p>
            </div>
          )}
        </div>
        
        {/* Footer with brain animation */}
        <div className="px-8 pb-6">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="animate-pulse">🧠</span>
            <span>Powered by GPT-4 Vision AI</span>
          </div>
        </div>
      </div>
      
      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes scale-in {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes wave {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes pop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        
        @keyframes draw-check {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }
        
        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translateY(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        
        .animate-wave {
          animation: wave 1s ease-in-out infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .animate-pop {
          animation: pop 0.5s ease-out;
        }
        
        .animate-draw-check {
          animation: draw-check 0.5s ease-out forwards;
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
