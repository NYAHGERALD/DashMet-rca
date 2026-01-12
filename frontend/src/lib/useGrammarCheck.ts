'use client';

/**
 * useGrammarCheck Hook - Easy integration for AI writing assistance
 * Can be used with any input/textarea component
 * Note: Grammar API is public, no authentication required
 */

import { useState, useCallback, useEffect, useRef } from 'react';

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

interface UseGrammarCheckOptions {
  debounceMs?: number;
  minLength?: number;
  context?: string;
  enabled?: boolean;
}

interface UseGrammarCheckReturn {
  issues: GrammarIssue[];
  metrics: GrammarMetrics | null;
  overallScore: number | null;
  isAnalyzing: boolean;
  isFixing: boolean;
  isEnhancing: boolean;
  hasIssues: boolean;
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  analyze: (text: string) => Promise<void>;
  quickFix: (text: string) => Promise<string>;
  enhance: (text: string, style?: 'professional' | 'formal' | 'concise' | 'detailed') => Promise<string>;
  applySuggestion: (text: string, issue: GrammarIssue, suggestion: string) => string;
  clearIssues: () => void;
}

export function useGrammarCheck(options: UseGrammarCheckOptions = {}): UseGrammarCheckReturn {
  const {
    debounceMs = 1500,
    minLength = 10,
    context,
    enabled = true,
  } = options;

  const [issues, setIssues] = useState<GrammarIssue[]>([]);
  const [metrics, setMetrics] = useState<GrammarMetrics | null>(null);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedRef = useRef<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const analyze = useCallback(async (text: string) => {
    if (!enabled || !text || text.length < minLength) {
      setIssues([]);
      setMetrics(null);
      setOverallScore(null);
      return;
    }

    // Don't re-analyze if text hasn't changed
    if (text === lastAnalyzedRef.current) return;

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the analysis
    debounceRef.current = setTimeout(async () => {
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
            lastAnalyzedRef.current = text;
          }
        }
      } catch (err) {
        console.error('Grammar analysis error:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }, debounceMs);
  }, [API_URL, context, enabled, minLength, debounceMs]);

  const quickFix = useCallback(async (text: string): Promise<string> => {
    if (!enabled || !text) return text;

    setIsFixing(true);
    try {
      const response = await fetch(`${API_URL}/api/grammar/quick-fix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.correctedText) {
          setIssues([]);
          lastAnalyzedRef.current = '';
          return data.data.correctedText;
        }
      }
    } catch (err) {
      console.error('Quick fix error:', err);
    } finally {
      setIsFixing(false);
    }
    return text;
  }, [API_URL, enabled]);

  const enhance = useCallback(async (
    text: string, 
    style: 'professional' | 'formal' | 'concise' | 'detailed' = 'professional'
  ): Promise<string> => {
    if (!enabled || !text) return text;

    setIsEnhancing(true);
    try {
      const response = await fetch(`${API_URL}/api/grammar/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, style, context }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.enhancedText) {
          lastAnalyzedRef.current = '';
          return data.data.enhancedText;
        }
      }
    } catch (err) {
      console.error('Enhance error:', err);
    } finally {
      setIsEnhancing(false);
    }
    return text;
  }, [API_URL, context, enabled]);

  const applySuggestion = useCallback((
    text: string,
    issue: GrammarIssue, 
    suggestion: string
  ): string => {
    const before = text.substring(0, issue.offset);
    const after = text.substring(issue.offset + issue.length);
    lastAnalyzedRef.current = '';
    return before + suggestion + after;
  }, []);

  const clearIssues = useCallback(() => {
    setIssues([]);
    setMetrics(null);
    setOverallScore(null);
    lastAnalyzedRef.current = '';
  }, []);

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const suggestionCount = issues.filter(i => i.severity === 'suggestion').length;

  return {
    issues,
    metrics,
    overallScore,
    isAnalyzing,
    isFixing,
    isEnhancing,
    hasIssues: issues.length > 0,
    errorCount,
    warningCount,
    suggestionCount,
    analyze,
    quickFix,
    enhance,
    applySuggestion,
    clearIssues,
  };
}

export type { GrammarIssue, GrammarMetrics };
