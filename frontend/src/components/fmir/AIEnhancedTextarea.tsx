'use client';

/**
 * AIEnhancedTextarea - AI-powered text enhancement for FMIR form fields
 * Features:
 * - Floating AI enhance button that appears when text is present
 * - Beautiful animations and loading states
 * - One-click text improvement using GPT
 * - Professional, human-friendly text corrections
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, Check, Wand2 } from 'lucide-react';

interface AIEnhancedTextareaProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
  context?: string; // Additional context for AI enhancement
  minRows?: number; // Minimum number of rows for auto-grow
  maxRows?: number; // Maximum number of rows before scrolling
}

const AIEnhancedTextarea: React.FC<AIEnhancedTextareaProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder = '',
  required = false,
  disabled = false,
  rows = 3,
  className = '',
  context,
  minRows = 3,
  maxRows = 12,
}) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [justEnhanced, setJustEnhanced] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

  // Line height in pixels (matches text-sm = 14px font with ~20px line height)
  const LINE_HEIGHT = 20;
  const PADDING = 16; // py-2 = 8px top + 8px bottom

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Calculate min and max heights
    const minHeight = minRows * LINE_HEIGHT + PADDING;
    const maxHeight = maxRows * LINE_HEIGHT + PADDING;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Get the scroll height (content height)
    const scrollHeight = textarea.scrollHeight;

    // Calculate new height within bounds
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;

    // Enable scrolling if content exceeds max height
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }, [minRows, maxRows]);

  // Adjust height whenever value changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [value, adjustTextareaHeight]);

  // Show button when there's meaningful text (at least 10 characters)
  useEffect(() => {
    const hasEnoughText = value && value.trim().length >= 10;
    setShowButton(Boolean(hasEnoughText));
    
    // Reset enhanced state when text changes
    if (justEnhanced) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setJustEnhanced(false);
      }, 2000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, justEnhanced]);

  const handleEnhance = async () => {
    if (!value || value.trim().length < 10 || isEnhancing || disabled) return;

    setIsEnhancing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/grammar/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: value,
          style: 'professional',
          context: context || `FMIR field: ${label}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.enhancedText) {
          // Create a synthetic event to update the form
          const syntheticEvent = {
            target: {
              name,
              value: data.data.enhancedText,
            },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          
          onChange(syntheticEvent);
          setJustEnhanced(true);
          
          // Auto-clear enhanced indicator after 3 seconds
          setTimeout(() => {
            setJustEnhanced(false);
          }, 3000);
        } else {
          setError('Could not enhance text');
        }
      } else {
        setError('Enhancement service unavailable');
      }
    } catch (err) {
      console.error('AI Enhancement error:', err);
      setError('Failed to enhance text');
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Label Row with AI Button */}
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>

        {/* AI Enhancement Button - Outside textarea */}
        <div 
          className={`
            transition-all duration-300 ease-out
            ${showButton && !disabled ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}
          `}
        >
          <button
            type="button"
            onClick={handleEnhance}
            disabled={isEnhancing || disabled || !showButton}
            title={justEnhanced ? 'Text enhanced!' : 'DashMet AI - Enhance text'}
            className={`
              group/btn relative flex items-center justify-center
              h-7 rounded-full overflow-hidden
              transition-all duration-300 ease-out
              shadow-md hover:shadow-lg hover:shadow-emerald-500/30
              transform hover:scale-105 active:scale-95
              disabled:cursor-not-allowed
              ${justEnhanced
                ? 'bg-gradient-to-br from-emerald-400 to-green-600 w-7'
                : 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 hover:from-emerald-400 hover:via-green-400 hover:to-teal-500 w-7 hover:w-[85px]'
              }
              ${isEnhancing ? 'w-7' : ''}
            `}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/50 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 blur-sm" />

            {/* Button content */}
            <span className="relative z-10 flex items-center justify-center gap-1.5 px-1.5">
              {isEnhancing ? (
                <Loader2 className="w-4 h-4 text-white animate-spin flex-shrink-0" />
              ) : justEnhanced ? (
                <Check className="w-4 h-4 text-white flex-shrink-0" />
              ) : (
                <>
                  {/* DM Circle */}
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[8px] font-bold text-white tracking-tight select-none">DM</span>
                  </span>
                  {/* Enhance text - slides out on hover */}
                  <span className="text-[10px] font-semibold text-white whitespace-nowrap overflow-hidden w-0 group-hover/btn:w-[45px] transition-all duration-300 ease-out opacity-0 group-hover/btn:opacity-100">
                    Enhance
                  </span>
                </>
              )}
            </span>

            {/* Sparkle decoration */}
            {!isEnhancing && !justEnhanced && (
              <>
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-75 group-hover/btn:opacity-0 transition-opacity" />
                <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-white rounded-full group-hover/btn:opacity-0 transition-opacity" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Textarea Container */}
      <div className="relative group">
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled || isEnhancing}
          className={`
            w-full px-3 py-2
            bg-white dark:bg-gray-700/80 
            border border-gray-300 dark:border-gray-600 
            rounded-lg 
            text-gray-900 dark:text-white 
            placeholder-gray-400 dark:placeholder-gray-500 
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
            disabled:opacity-50 disabled:cursor-not-allowed 
            resize-y transition-all text-sm overflow-hidden
            ${justEnhanced ? 'ring-2 ring-green-400 border-green-400' : ''}
            ${isEnhancing ? 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20' : ''}
          `}
        />

        {/* Enhancement indicator line */}
        {isEnhancing && (
          <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden rounded-t-lg">
            <div className="h-full w-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
          </div>
        )}

        {/* Success indicator line */}
        {justEnhanced && !isEnhancing && (
          <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden rounded-t-lg">
            <div className="h-full w-full bg-gradient-to-r from-green-400 to-emerald-400" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400 animate-fadeIn">
          {error}
        </p>
      )}
    </div>
  );
};

// Add the custom animation styles
const customStyles = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes subtle-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}

.animate-subtle-pulse {
  animation: subtle-pulse 2s ease-in-out infinite;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = customStyles;
  document.head.appendChild(styleSheet);
}

export default AIEnhancedTextarea;
