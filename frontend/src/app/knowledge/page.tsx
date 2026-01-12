'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { 
  Search, 
  BookOpen, 
  Lightbulb, 
  GraduationCap, 
  Eye, 
  ThumbsUp, 
  X, 
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  FileText,
  Brain,
  Target,
  Loader2
} from 'lucide-react';

// ============================================================================
// Type Definitions
// ============================================================================

interface KnowledgeArticle {
  id: string;
  title: string;
  summary: string;
  sourceIncidentId: string;
  incidentType: string;
  categoryNames: string[];
  rootCause: string;
  successfulActions: string[];
  keywords: string[];
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
}

interface RCACoachTips {
  method: string;
  description: string;
  steps?: string[];
  categories?: Record<string, string>;
  bestPractices: string[];
  commonMistakes?: string[];
}

interface SimilarIncident {
  id: string;
  incidentNumber?: string;
  customTitle?: string;
  description?: string;
  similarityScore: number;
  category?: { name: string };
  facility?: { name: string };
  createdAt: string;
  rcaAnalyses?: Array<{
    rootCauseStatement?: string;
  }>;
}

interface AIGuidance {
  aiInsights?: string;
  suggestedContent?: string;
  tips?: string[];
  questions?: string[];
  examples?: string[];
  commonPitfalls?: string[];
  industryBestPractices?: string[];
  nextSteps?: string[];
  error?: boolean;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const TABS = [
  { id: 'articles', name: 'Knowledge Articles', icon: BookOpen, emoji: '📚' },
  { id: 'search', name: 'Similar Incident Search', icon: Search, emoji: '🔍' },
  { id: 'coach', name: 'RCA Coach', icon: GraduationCap, emoji: '🎓' },
] as const;

const RCA_METHODS = [
  { id: 'FIVE_WHYS', name: '5 Whys Analysis', icon: '❓', description: 'Iterative questioning technique' },
  { id: 'FISHBONE', name: 'Fishbone Diagram', icon: '🐟', description: 'Cause-and-effect analysis' },
  { id: 'COMBINED', name: 'Combined Analysis', icon: '🔄', description: 'Comprehensive approach' },
] as const;

const COACH_STEPS = [
  { id: 'problem_statement', name: '1. Problem Statement' },
  { id: 'five_whys', name: '2. 5 Whys Analysis' },
  { id: 'fishbone', name: '3. Fishbone Diagram' },
  { id: 'root_cause', name: '4. Root Cause Identification' },
  { id: 'corrective_actions', name: '5. Corrective Actions' },
  { id: 'preventive_actions', name: '6. Preventive Actions' },
] as const;

// ============================================================================
// Main Component
// ============================================================================

function KnowledgePageContent() {
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'articles' | 'search' | 'coach'>('articles');
  
  // Articles state
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  
  // Similar search state
  const [similarDescription, setSimilarDescription] = useState('');
  const [similarResults, setSimilarResults] = useState<SimilarIncident[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  // Coach state
  const [selectedMethod, setSelectedMethod] = useState<string>('FIVE_WHYS');
  const [methodTips, setMethodTips] = useState<RCACoachTips | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [coachStep, setCoachStep] = useState('problem_statement');
  const [guidance, setGuidance] = useState<AIGuidance | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [incidentContext, setIncidentContext] = useState('');

  // ============================================================================
  // API Functions
  // ============================================================================

  const fetchArticles = useCallback(async () => {
    setArticlesLoading(true);
    setArticlesError('');
    
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      
      const response = await api.get(`/knowledge/articles?${params}`);
      setArticles(response.data.data?.articles || []);
    } catch (err: any) {
      console.error('Error fetching articles:', err);
      setArticlesError(err.response?.data?.error || 'Failed to fetch knowledge articles');
      setArticles([]);
    } finally {
      setArticlesLoading(false);
    }
  }, [searchQuery]);

  const fetchMethodTips = useCallback(async (method: string) => {
    setTipsLoading(true);
    
    try {
      const response = await api.get(`/knowledge/coach/tips/${method}`);
      setMethodTips(response.data.data || null);
    } catch (err: any) {
      console.error('Error fetching method tips:', err);
      // Set default tips if API fails
      setMethodTips(getDefaultTips(method));
    } finally {
      setTipsLoading(false);
    }
  }, []);

  const searchSimilarIncidents = async () => {
    if (!similarDescription.trim()) return;
    
    setSearchLoading(true);
    setSearchError('');
    
    try {
      const response = await api.post('/knowledge/search/similar', {
        description: similarDescription.trim(),
        limit: 10,
      });
      setSimilarResults(response.data.data?.results || []);
    } catch (err: any) {
      console.error('Error searching similar incidents:', err);
      setSearchError(err.response?.data?.error || 'Failed to search similar incidents');
      setSimilarResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const getAIGuidance = async () => {
    setGuidanceLoading(true);
    
    try {
      const response = await api.post('/knowledge/coach/guidance', {
        incidentDescription: incidentContext.trim() || 'General RCA guidance request',
        incidentType: 'FOOD_SAFETY',
        currentStep: coachStep,
        selectedMethod: selectedMethod,
      });
      setGuidance(response.data.data || getDefaultGuidance(coachStep));
    } catch (err: any) {
      console.error('Error getting AI guidance:', err);
      // Use fallback guidance
      setGuidance({ ...getDefaultGuidance(coachStep), error: true });
    } finally {
      setGuidanceLoading(false);
    }
  };

  const markArticleHelpful = async (articleId: string) => {
    try {
      await api.post(`/knowledge/articles/${articleId}/helpful`);
      setArticles(prev => prev.map(a => 
        a.id === articleId ? { ...a, helpfulCount: a.helpfulCount + 1 } : a
      ));
    } catch (err: any) {
      console.error('Error marking article helpful:', err);
    }
  };

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (activeTab === 'articles') {
      fetchArticles();
    }
  }, [activeTab, fetchArticles]);

  useEffect(() => {
    if (activeTab === 'coach') {
      fetchMethodTips(selectedMethod);
    }
  }, [activeTab, selectedMethod, fetchMethodTips]);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getDefaultTips = (method: string): RCACoachTips => {
    const defaults: Record<string, RCACoachTips> = {
      FIVE_WHYS: {
        method: '5 Whys Analysis',
        description: 'A simple but powerful technique for finding the root cause by asking "Why?" five times.',
        steps: [
          'Define the problem clearly',
          'Ask "Why?" and document the answer',
          'Repeat asking "Why?" for each answer',
          'Continue until you reach the root cause',
          'Verify the root cause makes sense'
        ],
        bestPractices: [
          'Focus on processes, not people',
          'Use facts, not assumptions',
          'Get input from those closest to the problem',
          'Document each answer clearly'
        ],
        commonMistakes: [
          'Stopping too soon',
          'Blaming individuals instead of systems',
          'Not involving the right people'
        ]
      },
      FISHBONE: {
        method: 'Fishbone Diagram (Ishikawa)',
        description: 'A visual tool that categorizes potential causes into major categories (6Ms).',
        categories: {
          'Man': 'Human factors and personnel',
          'Machine': 'Equipment and technology',
          'Method': 'Procedures and processes',
          'Material': 'Raw materials and supplies',
          'Measurement': 'Data collection and analysis',
          'Mother Nature': 'Environmental factors'
        },
        bestPractices: [
          'Brainstorm all possible causes',
          'Organize causes into categories',
          'Identify sub-causes for each main cause',
          'Prioritize the most likely root causes'
        ],
        commonMistakes: [
          'Not exploring all categories',
          'Focusing only on obvious causes',
          'Not validating assumptions'
        ]
      },
      COMBINED: {
        method: 'Combined RCA Approach',
        description: 'Uses both 5 Whys and Fishbone for comprehensive root cause analysis.',
        steps: [
          'Start with Fishbone to identify all potential causes',
          'Use 5 Whys to drill down on each significant cause',
          'Cross-reference findings from both methods',
          'Identify common root causes'
        ],
        bestPractices: [
          'Use Fishbone for breadth, 5 Whys for depth',
          'Document connections between causes',
          'Validate findings with data',
          'Involve cross-functional team members'
        ]
      }
    };
    return defaults[method] || defaults.FIVE_WHYS;
  };

  const getDefaultGuidance = (step: string): AIGuidance => {
    const defaults: Record<string, AIGuidance> = {
      problem_statement: {
        tips: [
          'Be specific about what happened',
          'Include when and where it occurred',
          'Quantify the impact if possible',
          'Avoid assigning blame'
        ],
        questions: [
          'What exactly went wrong?',
          'When did the problem first occur?',
          'Where did the problem happen?',
          'Who discovered the problem?'
        ],
        examples: [
          'On January 5, 2026, at 2:30 PM, metal fragments were found in Product X during quality inspection on Line 3, affecting Batch #2024-001.'
        ]
      },
      five_whys: {
        tips: [
          'Each answer should be factual, not assumed',
          'Continue until you reach a systemic cause',
          'It may take more or fewer than 5 whys',
          'Focus on processes, not people'
        ],
        questions: [
          'Why did this happen?',
          'What allowed this condition to exist?',
          'What process failed to prevent this?'
        ]
      },
      fishbone: {
        tips: [
          'Consider all 6M categories systematically',
          'Brainstorm without judgment first',
          'Look for interactions between causes',
          'Prioritize based on evidence'
        ]
      },
      root_cause: {
        tips: [
          'The root cause should explain the entire chain of events',
          'Addressing it should prevent recurrence',
          'It should be something you can control',
          'Verify with data or evidence'
        ]
      },
      corrective_actions: {
        tips: [
          'Address both immediate and systemic issues',
          'Assign clear ownership for each action',
          'Set realistic deadlines',
          'Include verification steps'
        ],
        nextSteps: [
          'Develop corrective action plan',
          'Assign owners and due dates',
          'Implement actions',
          'Verify effectiveness'
        ]
      },
      preventive_actions: {
        tips: [
          'Focus on preventing recurrence, not just fixing the current issue',
          'Consider systemic changes to processes and procedures',
          'Implement controls at multiple points in the process',
          'Include training and awareness programs',
          'Establish monitoring mechanisms to detect early warning signs'
        ],
        questions: [
          'What systemic changes can prevent similar incidents?',
          'Are there other areas where this could happen?',
          'What early warning indicators should we monitor?',
          'What training or awareness is needed?',
          'How will we verify the preventive measures are working?'
        ],
        examples: [
          'Implement automated temperature monitoring with alerts before critical thresholds are reached',
          'Add a second verification step in the quality control process',
          'Create a preventive maintenance schedule for equipment',
          'Develop standard operating procedures with built-in checkpoints'
        ],
        nextSteps: [
          'Identify all potential failure points',
          'Design preventive controls for each point',
          'Create monitoring and audit procedures',
          'Schedule periodic reviews of preventive measures',
          'Document lessons learned for future reference'
        ]
      }
    };
    return defaults[step] || defaults.problem_statement;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderArticlesTab = () => (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search articles by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchArticles()}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchArticles}
          disabled={articlesLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
        >
          {articlesLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          Search
        </button>
      </div>

      {/* Error State */}
      {articlesError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{articlesError}</p>
        </div>
      )}

      {/* Loading State */}
      {articlesLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading articles...</p>
        </div>
      )}

      {/* Empty State */}
      {!articlesLoading && !articlesError && articles.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <BookOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No knowledge articles found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Knowledge articles are automatically generated from closed incidents with validated root cause analyses.
          </p>
        </div>
      )}

      {/* Articles Grid */}
      {!articlesLoading && articles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-gray-900/50 transition-all duration-200 overflow-hidden"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                    article.incidentType === 'FOOD_SAFETY'
                      ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                      : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  }`}>
                    {article.incidentType.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Eye className="w-4 h-4" />
                    {article.viewCount}
                  </div>
                </div>

                {/* Title & Summary */}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">
                  {article.summary}
                </p>

                {/* Root Cause */}
                {article.rootCause && (
                  <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Root Cause:</p>
                    <p className="text-sm text-amber-800 dark:text-amber-300 line-clamp-2">{article.rootCause}</p>
                  </div>
                )}

                {/* Keywords */}
                {article.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {article.keywords.slice(0, 4).map((keyword, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-md"
                      >
                        {keyword}
                      </span>
                    ))}
                    {article.keywords.length > 4 && (
                      <span className="px-2 py-1 text-gray-400 dark:text-gray-500 text-xs">
                        +{article.keywords.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => markArticleHelpful(article.id)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Helpful ({article.helpfulCount})
                  </button>
                  <button
                    onClick={() => setSelectedArticle(article)}
                    className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
              <div className="flex-1 pr-4">
                <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full mb-2 ${
                  selectedArticle.incidentType === 'FOOD_SAFETY'
                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                }`}>
                  {selectedArticle.incidentType.replace('_', ' ')}
                </span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-8rem)] space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-gray-700 dark:text-gray-300">{selectedArticle.summary}</p>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Root Cause</h4>
                <p className="text-amber-800 dark:text-amber-300">{selectedArticle.rootCause}</p>
              </div>

              {selectedArticle.successfulActions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Successful Corrective Actions</h4>
                  <ul className="space-y-2">
                    {selectedArticle.successfulActions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedArticle.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm rounded-lg"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                Created: {formatDate(selectedArticle.createdAt)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSearchTab = () => (
    <div className="space-y-6">
      {/* Search Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Find Similar Incidents</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Describe your incident to find similar past incidents and their solutions
            </p>
          </div>
        </div>

        <textarea
          value={similarDescription}
          onChange={(e) => setSimilarDescription(e.target.value)}
          rows={4}
          placeholder="Describe the incident... (e.g., 'Metal fragment found in finished product during packaging inspection')"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />

        <button
          onClick={searchSimilarIncidents}
          disabled={searchLoading || !similarDescription.trim()}
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
        >
          {searchLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Find Similar Incidents
            </>
          )}
        </button>
      </div>

      {/* Error State */}
      {searchError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{searchError}</p>
        </div>
      )}

      {/* Results */}
      {similarResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Found {similarResults.length} Similar Incident{similarResults.length !== 1 ? 's' : ''}
            </h4>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {similarResults.map((incident, index) => (
              <div key={incident.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {incident.incidentNumber || `Incident ${index + 1}`}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      incident.similarityScore >= 70
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                        : incident.similarityScore >= 40
                        ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {incident.similarityScore}% match
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  {incident.customTitle || incident.description?.substring(0, 200) + '...'}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {incident.category?.name && <span>{incident.category.name}</span>}
                  {incident.facility?.name && <span>• {incident.facility.name}</span>}
                  <span>• {formatDate(incident.createdAt)}</span>
                </div>
                {incident.rcaAnalyses?.[0]?.rootCauseStatement && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <span className="font-medium text-green-700 dark:text-green-300">Root Cause: </span>
                    <span className="text-green-600 dark:text-green-400">{incident.rcaAnalyses[0].rootCauseStatement}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCoachTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Panel - Method Selection */}
      <div className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">RCA Methods</h3>
        </div>

        <div className="space-y-2 mb-6">
          {RCA_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`w-full px-4 py-3 rounded-lg text-left flex items-center gap-3 transition-all ${
                selectedMethod === method.id
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 border-2 border-purple-500 dark:border-purple-600'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <span className="text-2xl">{method.icon}</span>
              <div>
                <span className="font-medium block">{method.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{method.description}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Incident Context */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Describe Your Incident
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">For personalized AI guidance</p>
          <textarea
            value={incidentContext}
            onChange={(e) => setIncidentContext(e.target.value)}
            placeholder="E.g., 'A contamination event was detected in production line 3...'"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 p-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        {/* Step Selection */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Step-by-Step Guide
          </h4>
          <select
            value={coachStep}
            onChange={(e) => {
              setCoachStep(e.target.value);
              setGuidance(null);
            }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {COACH_STEPS.map((step) => (
              <option key={step.id} value={step.id}>{step.name}</option>
            ))}
          </select>
        </div>

        {/* Get Guidance Button */}
        <button
          onClick={getAIGuidance}
          disabled={guidanceLoading}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-all"
        >
          {guidanceLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              AI is thinking...
            </>
          ) : (
            <>
              <Brain className="w-5 h-5" />
              Get AI Guidance
            </>
          )}
        </button>
      </div>

      {/* Right Panel - Tips & Guidance */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-6">
        {/* Method Tips */}
        {tipsLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Loading method tips...</p>
          </div>
        ) : methodTips && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{methodTips.method}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-5">{methodTips.description}</p>

            {methodTips.steps && (
              <div className="mb-5">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Steps
                </h4>
                <ol className="space-y-2 list-decimal list-inside text-gray-700 dark:text-gray-300">
                  {methodTips.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {methodTips.categories && (
              <div className="mb-5">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Categories (6 Ms)</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(methodTips.categories).map(([cat, desc]) => (
                    <div key={cat} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="font-medium text-gray-900 dark:text-white">{cat}:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300 ml-1">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {methodTips.bestPractices && (
              <div className="mb-5">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Best Practices
                </h4>
                <ul className="space-y-2">
                  {methodTips.bestPractices.map((practice, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                      {practice}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {methodTips.commonMistakes && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-300 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Common Mistakes to Avoid
                </h4>
                <ul className="space-y-2">
                  {methodTips.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-red-700 dark:text-red-400">
                      <X className="w-4 h-4 flex-shrink-0 mt-1" />
                      {mistake}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* AI Guidance */}
        {guidanceLoading && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl p-8 border border-purple-200 dark:border-purple-800 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-spin mb-4" />
            <p className="text-purple-700 dark:text-purple-300 font-medium">AI is analyzing your context...</p>
            <p className="text-purple-500 dark:text-purple-400 text-sm mt-1">Generating personalized guidance</p>
          </div>
        )}

        {guidance && !guidanceLoading && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-purple-900 dark:text-purple-200">
                  AI Guidance: {COACH_STEPS.find(s => s.id === coachStep)?.name.replace(/^\d+\.\s*/, '')}
                </h3>
                {guidance.error && (
                  <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded">
                    Using fallback guidance
                  </span>
                )}
              </div>
            </div>

            {guidance.aiInsights && (
              <div className="mb-5 p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-indigo-500 shadow-sm">
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">✨ AI Insight</h4>
                <p className="text-gray-700 dark:text-gray-300">{guidance.aiInsights}</p>
              </div>
            )}

            {guidance.tips && guidance.tips.length > 0 && (
              <div className="mb-5">
                <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">💡 Tips</h4>
                <ul className="space-y-2">
                  {guidance.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-purple-800 dark:text-purple-300 bg-white dark:bg-gray-800 p-3 rounded-lg">
                      <span className="text-purple-500">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {guidance.questions && guidance.questions.length > 0 && (
              <div className="mb-5">
                <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">❓ Questions to Consider</h4>
                <ul className="space-y-2">
                  {guidance.questions.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-purple-800 dark:text-purple-300 bg-white dark:bg-gray-800 p-3 rounded-lg">
                      <span className="font-bold text-purple-500">{idx + 1}.</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {guidance.examples && guidance.examples.length > 0 && (
              <div className="mb-5">
                <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">📚 Examples</h4>
                <ul className="space-y-2">
                  {guidance.examples.map((example, idx) => (
                    <li key={idx} className="text-purple-800 dark:text-purple-300 bg-white dark:bg-gray-800 p-4 rounded-lg italic border border-purple-100 dark:border-purple-800">
                      &quot;{example}&quot;
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {guidance.nextSteps && guidance.nextSteps.length > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-300 mb-3">→ Next Steps</h4>
                <ul className="space-y-2">
                  {guidance.nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-green-700 dark:text-green-400">
                      <span className="font-bold">{idx + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="relative w-10 h-10">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Articles, search & RCA coaching</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="flex space-x-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-5 py-4 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="text-lg">{tab.emoji}</span>
                  <Icon className="w-5 h-5 hidden sm:block" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'articles' && renderArticlesTab()}
        {activeTab === 'search' && renderSearchTab()}
        {activeTab === 'coach' && renderCoachTab()}
      </main>
    </div>
  );
}

// ============================================================================
// Protected Export
// ============================================================================

export default function KnowledgePage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <KnowledgePageContent />
    </ProtectedRoute>
  );
}
