'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Save, X, ShieldOff, ArrowRight } from 'lucide-react';

interface FMIRVisibilityOffModalProps {
  isOpen: boolean;
  reportNumber: string;
  ownerName: string;
  saving: boolean;
  onSaveAndClose: () => void;
  onClose: () => void;
}

const FMIRVisibilityOffModal: React.FC<FMIRVisibilityOffModalProps> = ({
  isOpen,
  reportNumber,
  ownerName,
  saving,
  onSaveAndClose,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay for entrance animation
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6">
      {/* Animated Backdrop with blur */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br from-black/70 via-gray-900/60 to-black/70 backdrop-blur-md transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      
      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-amber-400/20 rounded-full animate-pulse"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + i * 0.5}s`,
            }}
          />
        ))}
      </div>
      
      {/* Modal Content */}
      <div 
        className={`relative bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[95vw] sm:max-w-md md:max-w-lg overflow-hidden transform transition-all duration-500 ease-out ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-8'
        }`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Animated Header with gradient */}
        <div className="relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 animate-gradient-x" />
          
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
          
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/10 rounded-full blur-lg" />
          
          <div className="relative py-6 sm:py-8 px-4">
            <div className="flex items-center justify-center">
              {/* Animated icon container */}
              <div className="relative">
                {/* Pulsing rings */}
                <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full animate-ping-slow" />
                <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                
                {/* Icon background */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-white/25 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 shadow-lg">
                  <ShieldOff className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-lg animate-bounce-subtle" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-4 sm:p-6 md:p-8">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white text-center mb-3 sm:mb-4 tracking-tight">
            Report Visibility Turned Off
          </h2>
          
          <div className="space-y-3 sm:space-y-4 text-center">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              The owner <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{ownerName}</span> has turned the visibility of this Foreign Material Report <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400">#{reportNumber}</span> OFF.
            </p>
            
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
              You can save your current work before closing, or simply close this page.
            </p>
            
            {/* Animated note box */}
            <div className="relative mt-4 sm:mt-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-100/50 via-orange-100/50 to-amber-100/50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-amber-900/20 animate-gradient-x rounded-xl" />
              <div className="relative bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-700/50 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 text-left">
                    <strong className="font-semibold">Note:</strong> After closing, you will be redirected to the Foreign Material Incident Reports page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer with beautiful action buttons */}
        <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Save Button - Primary */}
          <button
            onClick={onSaveAndClose}
            disabled={saving}
            className="group relative flex-1 overflow-hidden rounded-xl sm:rounded-2xl transition-all duration-300 disabled:cursor-not-allowed"
          >
            {/* Button background with gradient */}
            <div className={`absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 transition-all duration-300 ${
              saving ? 'opacity-70' : 'group-hover:from-blue-700 group-hover:via-indigo-700 group-hover:to-blue-800'
            }`} />
            
            {/* Shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            
            {/* Button content */}
            <div className="relative flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 text-white font-semibold text-sm sm:text-base">
              {saving ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 group-hover:-rotate-6" />
                  <span>Save FMIR & Close</span>
                </>
              )}
            </div>
            
            {/* Bottom glow */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
          
          {/* Close Button - Secondary */}
          <button
            onClick={onClose}
            disabled={saving}
            className="group relative flex-1 overflow-hidden rounded-xl sm:rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800"
          >
            {/* Hover background */}
            <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-750 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Button content */}
            <div className="relative flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 text-gray-700 dark:text-gray-200 font-semibold text-sm sm:text-base">
              <X className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 group-hover:rotate-90" />
              <span>Close Without Saving</span>
            </div>
            
            {/* Subtle border animation */}
            <div className="absolute inset-0 rounded-xl sm:rounded-2xl border-2 border-transparent group-hover:border-gray-300 dark:group-hover:border-gray-500 transition-colors duration-300" />
          </button>
        </div>
        
        {/* Bottom accent line */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
      </div>

      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
        @keyframes ping-slow {
          75%, 100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default FMIRVisibilityOffModal;
