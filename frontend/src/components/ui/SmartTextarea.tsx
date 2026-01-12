'use client';

/**
 * SmartTextarea - Enterprise AI Writing Assistant Component
 * Provides Grammarly-like functionality with:
 * - Real-time grammar and spelling checking
 * - Inline error highlighting with hover tooltips
 * - AI-powered suggestions
 * - Quick fix functionality
 * - Text enhancement options
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };
  
  return debounced as T & { cancel: () => void };
}

interface GrammarIssue {
  type: 'spelling' | 'grammar' | 'punctuation' | 'style' | 'clarity';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  offset: number;
  length: number;
  originalText: string;
  suggestions: string[];
  explanation?: string;
}

interface GrammarMetrics {
  spelling: number;
  grammar: number;
  punctuation: number;
  clarity: number;
  tone: number;
}

interface SmartTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  context?: string; // e.g., "incident description", "CAPA action"
  enableGrammarCheck?: boolean;
  enableAutoComplete?: boolean;
  enableEnhance?: boolean;
  showMetrics?: boolean;
  debounceMs?: number;
  error?: string;
  helperText?: string;
  id?: string;
  name?: string;
}

const SmartTextarea: React.FC<SmartTextareaProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  label,
  required = false,
  disabled = false,
  rows = 4,
  maxLength,
  className = '',
  context,
  enableGrammarCheck = true,
  enableAutoComplete = false,
  enableEnhance = true,
  showMetrics = true,
  debounceMs = 1500,
  error,
  helperText,
  id,
  name,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // State
  const [issues, setIssues] = useState<GrammarIssue[]>([]);
  const [metrics, setMetrics] = useState<GrammarMetrics | null>(null);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<GrammarIssue | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoCompletions, setAutoCompletions] = useState<string[]>([]);
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const [enhanceStyle, setEnhanceStyle] = useState<'professional' | 'formal' | 'concise' | 'detailed'>('professional');
  const [showEnhanceMenu, setShowEnhanceMenu] = useState(false);
  const [lastAnalyzedText, setLastAnalyzedText] = useState('');
  const [hoveredIssue, setHoveredIssue] = useState<GrammarIssue | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  // API URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  // Analyze grammar
  const analyzeGrammar = useCallback(async (text: string) => {
    if (!text || text.trim().length < 10 || !enableGrammarCheck) {
      setIssues([]);
      setMetrics(null);
      setOverallScore(null);
      return;
    }

    // Don't re-analyze if text hasn't changed
    if (text === lastAnalyzedText) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_URL}/api/grammar/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, context }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setIssues(data.data.issues || []);
          setMetrics(data.data.metrics || null);
          setOverallScore(data.data.overallScore ?? null);
          setLastAnalyzedText(text);
        }
      }
    } catch (err) {
      console.error('Grammar analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [API_URL, context, enableGrammarCheck, lastAnalyzedText]);

  // Debounced analyze
  const debouncedAnalyze = useMemo(
    () => debounce(analyzeGrammar, debounceMs),
    [analyzeGrammar, debounceMs]
  );

  // Trigger analysis on value change
  useEffect(() => {
    if (enableGrammarCheck && value && value.length >= 10) {
      debouncedAnalyze(value);
    }
    return () => {
      debouncedAnalyze.cancel();
    };
  }, [value, debouncedAnalyze, enableGrammarCheck]);

  // Quick fix all issues
  const handleQuickFix = async () => {
    if (!value) return;

    setIsFixing(true);
    try {
      const response = await fetch(`${API_URL}/api/grammar/quick-fix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: value }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.correctedText) {
          onChange(data.data.correctedText);
          setIssues([]);
          setLastAnalyzedText(''); // Force re-analysis
        }
      }
    } catch (err) {
      console.error('Quick fix error:', err);
    } finally {
      setIsFixing(false);
    }
  };

  // Enhance text
  const handleEnhance = async (style: 'professional' | 'formal' | 'concise' | 'detailed') => {
    if (!value) return;

    setIsEnhancing(true);
    setShowEnhanceMenu(false);
    try {
      const response = await fetch(`${API_URL}/api/grammar/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: value, style, context }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.enhancedText) {
          onChange(data.data.enhancedText);
          setLastAnalyzedText(''); // Force re-analysis
        }
      }
    } catch (err) {
      console.error('Enhance error:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Apply suggestion for a specific issue
  const applySuggestion = (issue: GrammarIssue, suggestion: string) => {
    const before = value.substring(0, issue.offset);
    const after = value.substring(issue.offset + issue.length);
    onChange(before + suggestion + after);
    setSelectedIssue(null);
    setShowSuggestions(false);
    setLastAnalyzedText(''); // Force re-analysis
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  // Get issue type color
  const getIssueColor = (issue: GrammarIssue) => {
    switch (issue.severity) {
      case 'error':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'suggestion':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'border-gray-300';
    }
  };

  // Get issue icon
  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'spelling':
        return '📝';
      case 'grammar':
        return '📖';
      case 'punctuation':
        return '✏️';
      case 'style':
        return '🎨';
      case 'clarity':
        return '💡';
      default:
        return '⚠️';
    }
  };

  // Get underline color based on severity
  const getUnderlineColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      case 'suggestion':
        return 'border-blue-500';
      default:
        return 'border-gray-400';
    }
  };

  // Sync scroll between textarea and highlight layer
  const syncScroll = () => {
    if (textareaRef.current && highlightLayerRef.current) {
      highlightLayerRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightLayerRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Handle mouse enter on highlighted text
  const handleIssueHover = (issue: GrammarIssue, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = textareaRef.current?.parentElement?.getBoundingClientRect();
    
    if (containerRect) {
      setTooltipPosition({
        top: rect.top - containerRect.top - 8,
        left: Math.min(rect.left - containerRect.left, containerRect.width - 280),
      });
    }
    setHoveredIssue(issue);
  };

  // Handle mouse leave on highlighted text
  const handleIssueLeave = () => {
    setHoveredIssue(null);
    setTooltipPosition(null);
  };

  // Render text with inline highlights
  const renderHighlightedText = () => {
    if (!value || issues.length === 0) {
      return <span style={{ color: 'transparent' }}>{value || ' '}</span>;
    }

    // Sort issues by offset
    const sortedIssues = [...issues].sort((a, b) => a.offset - b.offset);
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedIssues.forEach((issue, idx) => {
      // Add text before this issue
      if (issue.offset > lastIndex) {
        elements.push(
          <span key={`text-${idx}`} style={{ color: 'transparent' }}>
            {value.substring(lastIndex, issue.offset)}
          </span>
        );
      }

      // Add the highlighted issue text
      elements.push(
        <span
          key={`issue-${idx}`}
          className={`relative cursor-pointer border-b-2 ${getUnderlineColor(issue.severity)}`}
          style={{ 
            color: 'transparent',
            backgroundColor: issue.severity === 'error' ? 'rgba(239, 68, 68, 0.15)' : 
                            issue.severity === 'warning' ? 'rgba(234, 179, 8, 0.15)' : 
                            'rgba(59, 130, 246, 0.15)',
            borderRadius: '2px',
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => handleIssueHover(issue, e)}
          onMouseLeave={handleIssueLeave}
          onClick={() => {
            if (issue.suggestions.length > 0) {
              applySuggestion(issue, issue.suggestions[0]);
            }
          }}
        >
          {value.substring(issue.offset, issue.offset + issue.length)}
        </span>
      );

      lastIndex = issue.offset + issue.length;
    });

    // Add remaining text
    if (lastIndex < value.length) {
      elements.push(
        <span key="text-end" style={{ color: 'transparent' }}>
          {value.substring(lastIndex)}
        </span>
      );
    }

    return <>{elements}</>;
  };

  const hasIssues = issues.length > 0;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const suggestionCount = issues.filter(i => i.severity === 'suggestion').length;

  return (
    <div className={`smart-textarea-container ${className}`}>
      {/* Label */}
      {label && (
        <label 
          htmlFor={id || name}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Toolbar */}
      {enableGrammarCheck && value && value.length >= 10 && (
        <div className="flex items-center justify-between mb-2 px-1">
          {/* Left side - Status and Score */}
          <div className="flex items-center gap-3">
            {isAnalyzing ? (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking...
              </span>
            ) : overallScore !== null && showMetrics ? (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${getScoreColor(overallScore)}`}>
                  {overallScore}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Score</span>
              </div>
            ) : null}

            {/* Issue counts */}
            {!isAnalyzing && hasIssues && (
              <div className="flex items-center gap-2 text-xs">
                {errorCount > 0 && (
                  <span className="text-red-500">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
                )}
                {warningCount > 0 && (
                  <span className="text-yellow-600">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
                )}
                {suggestionCount > 0 && (
                  <span className="text-blue-500">{suggestionCount} suggestion{suggestionCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {/* Quick Fix Button */}
            {hasIssues && (
              <button
                type="button"
                onClick={handleQuickFix}
                disabled={isFixing || disabled}
                className="text-xs px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50"
              >
                {isFixing ? 'Fixing...' : '✨ Fix All'}
              </button>
            )}

            {/* Enhance Button */}
            {enableEnhance && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEnhanceMenu(!showEnhanceMenu)}
                  disabled={isEnhancing || disabled}
                  className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
                >
                  {isEnhancing ? 'Enhancing...' : '🚀 Enhance'}
                </button>
                
                {showEnhanceMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleEnhance('professional')}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      💼 Professional
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnhance('formal')}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      📋 Formal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnhance('concise')}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      ✂️ Concise
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnhance('detailed')}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      📝 Detailed
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Textarea with highlight overlay */}
      <div className="relative">
        {/* Highlight overlay - positioned behind textarea */}
        <div
          ref={highlightLayerRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            padding: '8px 12px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: 'transparent',
          }}
          aria-hidden="true"
        >
          {renderHighlightedText()}
        </div>

        <textarea
          ref={textareaRef}
          id={id || name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={`
            w-full px-3 py-2 border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            dark:bg-gray-800 dark:border-gray-600 dark:text-white
            ${error ? 'border-red-500' : hasIssues && errorCount > 0 ? 'border-red-300' : 'border-gray-300'}
            ${className}
          `}
          style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
          onScroll={syncScroll}
        />

        {/* Hover tooltip for issues */}
        {hoveredIssue && tooltipPosition && (
          <div
            className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 max-w-xs"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg">{getIssueIcon(hoveredIssue.type)}</span>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{hoveredIssue.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                  {hoveredIssue.type} • {hoveredIssue.severity}
                </p>
              </div>
            </div>
            
            {hoveredIssue.explanation && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 italic">{hoveredIssue.explanation}</p>
            )}
            
            {hoveredIssue.suggestions.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Click to replace with:</p>
                <div className="flex flex-wrap gap-1">
                  {hoveredIssue.suggestions.slice(0, 3).map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        applySuggestion(hoveredIssue, suggestion);
                        setHoveredIssue(null);
                        setTooltipPosition(null);
                      }}
                      className="px-2 py-1 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded text-green-700 dark:text-green-300 text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors font-medium"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Character count */}
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 z-10">
            {value.length}/{maxLength}
          </div>
        )}
      </div>

      {/* Error or Helper Text */}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}

      {/* Issues List */}
      {hasIssues && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Issues found:</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {issues.map((issue, index) => (
              <div
                key={index}
                className={`p-2 border-l-2 rounded-r text-xs cursor-pointer hover:shadow-sm transition-shadow ${getIssueColor(issue)}`}
                onClick={() => {
                  setSelectedIssue(selectedIssue === issue ? null : issue);
                  setShowSuggestions(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <span>{getIssueIcon(issue.type)}</span>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{issue.message}</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                        &quot;{issue.originalText}&quot;
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    issue.severity === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                    issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                    {issue.type}
                  </span>
                </div>

                {/* Suggestions dropdown */}
                {selectedIssue === issue && showSuggestions && issue.suggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {issue.explanation && (
                      <p className="text-gray-600 dark:text-gray-400 mb-2 italic">{issue.explanation}</p>
                    )}
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Suggestions:</p>
                    <div className="flex flex-wrap gap-1">
                      {issue.suggestions.map((suggestion, sIndex) => (
                        <button
                          key={sIndex}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            applySuggestion(issue, suggestion);
                          }}
                          className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Panel */}
      {showMetrics && metrics && !isAnalyzing && value.length >= 10 && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Writing Quality</p>
          <div className="grid grid-cols-5 gap-2 text-xs">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className={`font-semibold ${getScoreColor(value)}`}>{value}</div>
                <div className="text-gray-500 dark:text-gray-400 capitalize">{key}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartTextarea;
