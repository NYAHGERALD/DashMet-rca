'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';
import { formatDate } from '@/lib/dateUtils';

interface TrendData {
  date: string;
  count: number;
}

interface IncidentTrends {
  period: { days: number; start: string; end: string; groupBy: string };
  summary: {
    totalIncidents: number;
    resolvedIncidents: number;
    resolutionRate: string;
    avgResolutionTimeHours: string;
    trendDirection: string;
    trendPercentage: string;
  };
  trends: TrendData[];
  breakdowns: {
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byFacility: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

interface DowntimeData {
  period: { days: number; start: string; end: string };
  summary: {
    totalDowntimeEvents: number;
    totalDowntimeHours: string;
    avgDowntimePerEvent: string;
    mtbf: string;
  };
  breakdowns: {
    byLine: Record<string, number>;
    byCategory: Record<string, number>;
    byFacility: Record<string, number>;
  };
  topFailureModes: { mode: string; count: number }[];
  trend: TrendData[];
}

interface FoodSafetyData {
  period: { days: number; start: string; end: string };
  summary: {
    totalIncidents: number;
    criticalIncidents: number;
    highIncidents: number;
    riskScore: string;
    riskLevel: string;
  };
  breakdowns: {
    byCategory: Record<string, number>;
    byFacility: Record<string, number>;
    byLine: Record<string, number>;
    byRegulatoryTag: Record<string, number>;
    byRootCausePattern: Record<string, number>;
  };
  trend: TrendData[];
  recommendations: string[];
}

interface ReliabilityData {
  period: { days: number; start: string; end: string };
  summary: {
    totalFailures: number;
    totalDowntimeHours: string;
    overallMTBF: string;
    overallMTTR: string;
  };
  lineMetrics: {
    lineName: string;
    failureCount: number;
    totalDowntimeHours: number;
    mtbf: string;
    mttr: string;
    availability: string;
  }[];
  failureCategories: Record<string, number>;
  trend: TrendData[];
}

interface PredictionData {
  highRiskPatterns: {
    patternId: string;
    category: string;
    facility: string;
    line: string;
    occurrenceCount: number;
    avgDaysBetween: string;
    lastOccurred: string;
    riskScore: string;
    riskLevel: string;
    daysSinceLast: number;
    predictedNextOccurrence: string;
  }[];
  recurrenceAlerts: {
    actionId: string;
    incidentNumber: string;
    facility: string;
    category: string;
    actionTitle: string;
    owner: string;
    status: string;
  }[];
  summary: {
    totalPatternsAnalyzed: number;
    highRiskPatterns: number;
    activeRecurrenceAlerts: number;
  };
}

function AnalyticsContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trends' | 'downtime' | 'foodsafety' | 'reliability' | 'predictions'>('trends');
  const [period, setPeriod] = useState('90');
  
  // Data states
  const [incidentTrends, setIncidentTrends] = useState<IncidentTrends | null>(null);
  const [downtimeData, setDowntimeData] = useState<DowntimeData | null>(null);
  const [foodSafetyData, setFoodSafetyData] = useState<FoodSafetyData | null>(null);
  const [reliabilityData, setReliabilityData] = useState<ReliabilityData | null>(null);
  const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchDataForTab(activeTab);
    }
  }, [user, activeTab, period]);

  const fetchDataForTab = async (tab: string) => {
    if (!user) return;
    
    setDataLoading(true);
    setError('');
    
    try {
      const token = await user.getIdToken();
      let endpoint = '';
      
      switch (tab) {
        case 'trends':
          endpoint = `/analytics/trends/incidents?period=${period}`;
          break;
        case 'downtime':
          endpoint = `/analytics/downtime?period=${period}`;
          break;
        case 'foodsafety':
          endpoint = `/analytics/food-safety?period=${period}`;
          break;
        case 'reliability':
          endpoint = `/analytics/reliability?period=${period}`;
          break;
        case 'predictions':
          endpoint = '/analytics/predictions';
          break;
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const result = await response.json();
      
      switch (tab) {
        case 'trends':
          setIncidentTrends(result.data);
          break;
        case 'downtime':
          setDowntimeData(result.data);
          break;
        case 'foodsafety':
          setFoodSafetyData(result.data);
          break;
        case 'reliability':
          setReliabilityData(result.data);
          break;
        case 'predictions':
          setPredictionData(result.data);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setDataLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  };

  const getTrendColor = (direction: string, isPositive: boolean = false) => {
    if (direction === 'up') return isPositive ? 'text-green-600' : 'text-red-600';
    if (direction === 'down') return isPositive ? 'text-red-600' : 'text-green-600';
    return 'text-gray-600';
  };

  const renderBarChart = (data: Record<string, number>, title: string, color: string = 'blue') => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxValue = Math.max(...entries.map(e => e[1]), 1);
    
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
        <div className="space-y-2">
          {entries.map(([label, value]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-24 truncate" title={label}>{label}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div 
                  className={`bg-${color}-500 h-4 rounded-full`}
                  style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : color === 'orange' ? '#f97316' : '#ef4444' }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 w-8 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrendChart = (data: TrendData[]) => {
    if (data.length === 0) return <div className="text-gray-500 text-center py-8">No trend data available</div>;
    
    const maxCount = Math.max(...data.map(d => d.count), 1);
    const chartHeight = 150;
    
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Trend Over Time</h4>
        <div className="flex items-end gap-1 h-40">
          {data.map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${(item.count / maxCount) * chartHeight}px` }}
              />
              <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top-left">
                {formatDate(item.date, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-blue-200 dark:border-blue-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading analytics...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'trends', name: 'Incident Trends', icon: '📈' },
              { id: 'downtime', name: 'Downtime Analysis', icon: '⏱️' },
              { id: 'foodsafety', name: 'Food Safety Risk', icon: '🍎' },
              { id: 'reliability', name: 'Machine Reliability', icon: '⚙️' },
              { id: 'predictions', name: 'Predictive Insights', icon: '🔮' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Period Selector */}
        {activeTab !== 'predictions' && (
          <div className="mb-6 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Time Period:</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {dataLoading ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
            <div className="relative mb-8">
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-blue-200 dark:border-blue-900/50" />
              <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading analytics data...</p>
            <div className="flex items-center gap-1.5 mt-6">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          <>
            {/* Incident Trends Tab */}
            {activeTab === 'trends' && incidentTrends && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Total Incidents</p>
                    <p className="text-2xl font-bold text-gray-900">{incidentTrends.summary.totalIncidents}</p>
                    <p className={`text-sm ${getTrendColor(incidentTrends.summary.trendDirection)}`}>
                      {getTrendIcon(incidentTrends.summary.trendDirection)} {incidentTrends.summary.trendPercentage} vs prev period
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Resolved</p>
                    <p className="text-2xl font-bold text-green-600">{incidentTrends.summary.resolvedIncidents}</p>
                    <p className="text-sm text-gray-500">{incidentTrends.summary.resolutionRate} resolution rate</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Avg Resolution Time</p>
                    <p className="text-2xl font-bold text-blue-600">{incidentTrends.summary.avgResolutionTimeHours}h</p>
                    <p className="text-sm text-gray-500">hours to resolve</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Open</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {incidentTrends.summary.totalIncidents - incidentTrends.summary.resolvedIncidents}
                    </p>
                    <p className="text-sm text-gray-500">pending resolution</p>
                  </div>
                </div>

                {/* Trend Chart */}
                {renderTrendChart(incidentTrends.trends)}

                {/* Breakdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderBarChart(incidentTrends.breakdowns.byType, 'By Type', 'blue')}
                  {renderBarChart(incidentTrends.breakdowns.bySeverity, 'By Severity', 'orange')}
                </div>
              </div>
            )}

            {/* Downtime Tab */}
            {activeTab === 'downtime' && downtimeData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Downtime Events</p>
                    <p className="text-2xl font-bold text-gray-900">{downtimeData.summary.totalDowntimeEvents}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Total Downtime</p>
                    <p className="text-2xl font-bold text-red-600">{downtimeData.summary.totalDowntimeHours}h</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Avg Downtime/Event</p>
                    <p className="text-2xl font-bold text-orange-600">{downtimeData.summary.avgDowntimePerEvent}h</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">MTBF</p>
                    <p className="text-2xl font-bold text-blue-600">{downtimeData.summary.mtbf}</p>
                  </div>
                </div>

                {renderTrendChart(downtimeData.trend)}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderBarChart(downtimeData.breakdowns.byLine, 'By Production Line', 'red')}
                  {renderBarChart(downtimeData.breakdowns.byCategory, 'By Failure Category', 'orange')}
                </div>

                {/* Top Failure Modes */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Top Failure Modes</h4>
                  <div className="space-y-2">
                    {downtimeData.topFailureModes.map((fm, index) => (
                      <div key={index} className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-sm text-gray-600">{fm.mode}...</span>
                        <span className="text-sm font-medium text-gray-900">{fm.count} occurrences</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Food Safety Tab */}
            {activeTab === 'foodsafety' && foodSafetyData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Total FS Incidents</p>
                    <p className="text-2xl font-bold text-gray-900">{foodSafetyData.summary.totalIncidents}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Critical</p>
                    <p className="text-2xl font-bold text-red-600">{foodSafetyData.summary.criticalIncidents}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">High</p>
                    <p className="text-2xl font-bold text-orange-600">{foodSafetyData.summary.highIncidents}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Risk Score</p>
                    <p className="text-2xl font-bold">{foodSafetyData.summary.riskScore}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Risk Level</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(foodSafetyData.summary.riskLevel)}`}>
                      {foodSafetyData.summary.riskLevel}
                    </span>
                  </div>
                </div>

                {renderTrendChart(foodSafetyData.trend)}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderBarChart(foodSafetyData.breakdowns.byCategory, 'By Category', 'red')}
                  {renderBarChart(foodSafetyData.breakdowns.byRootCausePattern, 'By Root Cause Pattern', 'orange')}
                </div>

                {/* Recommendations */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">🎯 Recommendations</h4>
                  <ul className="space-y-1">
                    {foodSafetyData.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-yellow-700">• {rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Reliability Tab */}
            {activeTab === 'reliability' && reliabilityData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Total Failures</p>
                    <p className="text-2xl font-bold text-gray-900">{reliabilityData.summary.totalFailures}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Total Downtime</p>
                    <p className="text-2xl font-bold text-red-600">{reliabilityData.summary.totalDowntimeHours}h</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Overall MTBF</p>
                    <p className="text-2xl font-bold text-blue-600">{reliabilityData.summary.overallMTBF}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Overall MTTR</p>
                    <p className="text-2xl font-bold text-orange-600">{reliabilityData.summary.overallMTTR}</p>
                  </div>
                </div>

                {renderTrendChart(reliabilityData.trend)}

                {/* Line Metrics Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <h4 className="text-sm font-medium text-gray-700 p-4 border-b">Line Performance Metrics</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failures</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Downtime (hrs)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MTBF (hrs)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MTTR (hrs)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reliabilityData.lineMetrics.map((line, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{line.lineName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{line.failureCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{line.totalDowntimeHours.toFixed(1)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{line.mtbf}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{line.mttr}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`${parseFloat(line.availability) >= 95 ? 'text-green-600' : parseFloat(line.availability) >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {line.availability}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Predictions Tab */}
            {activeTab === 'predictions' && predictionData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Patterns Analyzed</p>
                    <p className="text-2xl font-bold text-gray-900">{predictionData.summary.totalPatternsAnalyzed}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">High Risk Patterns</p>
                    <p className="text-2xl font-bold text-red-600">{predictionData.summary.highRiskPatterns}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Recurrence Alerts</p>
                    <p className="text-2xl font-bold text-orange-600">{predictionData.summary.activeRecurrenceAlerts}</p>
                  </div>
                </div>

                {/* High Risk Patterns */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <h4 className="text-sm font-medium text-gray-700 p-4 border-b">🔮 High Risk Recurrence Patterns</h4>
                  {predictionData.highRiskPatterns.length === 0 ? (
                    <p className="text-gray-500 p-4 text-center">No high-risk patterns detected</p>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {predictionData.highRiskPatterns.map((pattern, index) => (
                        <div key={index} className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">{pattern.category}</h5>
                              <p className="text-sm text-gray-500">
                                {pattern.facility} • {pattern.line}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(pattern.riskLevel)}`}>
                              Risk: {pattern.riskScore}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Occurrences:</span>
                              <span className="ml-2 font-medium">{pattern.occurrenceCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Avg Days Between:</span>
                              <span className="ml-2 font-medium">{pattern.avgDaysBetween}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Days Since Last:</span>
                              <span className="ml-2 font-medium">{pattern.daysSinceLast}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Predicted Next:</span>
                              <span className="ml-2 font-medium text-red-600">
                                {formatDate(pattern.predictedNextOccurrence)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recurrence Alerts */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <h4 className="text-sm font-medium text-gray-700 p-4 border-b">⚠️ Active Recurrence Alerts</h4>
                  {predictionData.recurrenceAlerts.length === 0 ? (
                    <p className="text-gray-500 p-4 text-center">No active recurrence alerts</p>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Incident</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {predictionData.recurrenceAlerts.map((alert, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                              {alert.incidentNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.category}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{alert.actionTitle}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.owner}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                alert.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                alert.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {alert.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}
