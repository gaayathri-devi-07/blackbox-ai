const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, 'frontend', 'app', 'journey', 'improvement');
const filePath = path.join(dirPath, 'page.tsx');

// Create directory recursively
try {
  fs.mkdirSync(dirPath, { recursive: true });
  console.log('✓ Directory created:', dirPath);
} catch (error) {
  console.error('✗ Error creating directory:', error.message);
  process.exit(1);
}

// Create file with page content
const fileContent = `'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, Brain, MessageSquare, Eye, Target, Lightbulb, Trophy, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface InterviewSession {
  id: string;
  timestamp: number;
  type: 'mock' | 'gd';
  company?: string;
  role?: string;
  scores?: {
    technical?: number;
    coding?: number;
    communication?: number;
    bodyLanguage?: number;
    eyeContact?: number;
    smileCount?: number;
    posture?: number;
  };
  feedback?: string[];
}

interface MetricCard {
  title: string;
  icon: React.ReactNode;
  score: number;
  insights: string[];
  color: string;
}

export default function ImprovementPlanPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Load session history from localStorage
      const historyRaw = localStorage.getItem('interviewSessionHistory');
      const mockResultsRaw = localStorage.getItem('mockResults');
      const gdResultsRaw = localStorage.getItem('gdResults');

      const loadedSessions: InterviewSession[] = [];

      // Parse main history
      if (historyRaw) {
        const history = JSON.parse(historyRaw);
        if (Array.isArray(history)) {
          loadedSessions.push(...history);
        }
      }

      // Parse mock results
      if (mockResultsRaw) {
        const mockResults = JSON.parse(mockResultsRaw);
        if (Array.isArray(mockResults)) {
          loadedSessions.push(...mockResults.map(r => ({ ...r, type: 'mock' as const })));
        } else if (mockResults.scores) {
          loadedSessions.push({ ...mockResults, type: 'mock' as const, id: 'mock-latest', timestamp: Date.now() });
        }
      }

      // Parse GD results
      if (gdResultsRaw) {
        const gdResults = JSON.parse(gdResultsRaw);
        if (Array.isArray(gdResults)) {
          loadedSessions.push(...gdResults.map(r => ({ ...r, type: 'gd' as const })));
        } else if (gdResults.scores) {
          loadedSessions.push({ ...gdResults, type: 'gd' as const, id: 'gd-latest', timestamp: Date.now() });
        }
      }

      setSessions(loadedSessions);

      if (loadedSessions.length > 0) {
        calculateMetrics(loadedSessions);
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateMetrics = (sessions: InterviewSession[]) => {
    const technicalScores: number[] = [];
    const codingScores: number[] = [];
    const communicationScores: number[] = [];
    const bodyLanguageScores: number[] = [];

    sessions.forEach(session => {
      if (session.scores) {
        if (session.scores.technical !== undefined) technicalScores.push(session.scores.technical);
        if (session.scores.coding !== undefined) codingScores.push(session.scores.coding);
        if (session.scores.communication !== undefined) communicationScores.push(session.scores.communication);
        if (session.scores.bodyLanguage !== undefined) {
          bodyLanguageScores.push(session.scores.bodyLanguage);
        } else if (session.scores.eyeContact !== undefined && session.scores.posture !== undefined) {
          // Calculate body language from eye contact and posture
          const blScore = (session.scores.eyeContact * 0.6 + session.scores.posture * 0.4);
          bodyLanguageScores.push(blScore);
        }
      }
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const technicalAvg = avg(technicalScores);
    const codingAvg = avg(codingScores);
    const communicationAvg = avg(communicationScores);
    const bodyLanguageAvg = avg(bodyLanguageScores);

    const metricsData: MetricCard[] = [
      {
        title: 'Technical Depth',
        icon: <Brain className="w-6 h-6" />,
        score: Math.round(technicalAvg),
        insights: generateInsights('technical', technicalAvg, technicalScores),
        color: 'from-blue-500 to-cyan-500'
      },
      {
        title: 'Coding Efficiency',
        icon: <Target className="w-6 h-6" />,
        score: Math.round(codingAvg),
        insights: generateInsights('coding', codingAvg, codingScores),
        color: 'from-purple-500 to-pink-500'
      },
      {
        title: 'Communication',
        icon: <MessageSquare className="w-6 h-6" />,
        score: Math.round(communicationAvg),
        insights: generateInsights('communication', communicationAvg, communicationScores),
        color: 'from-green-500 to-emerald-500'
      },
      {
        title: 'Body Language',
        icon: <Eye className="w-6 h-6" />,
        score: Math.round(bodyLanguageAvg),
        insights: generateInsights('bodyLanguage', bodyLanguageAvg, bodyLanguageScores),
        color: 'from-orange-500 to-red-500'
      }
    ];

    setMetrics(metricsData);
  };

  const generateInsights = (category: string, avg: number, scores: number[]): string[] => {
    const insights: string[] = [];

    if (scores.length === 0) {
      return ['No data available yet. Complete interviews to see insights.'];
    }

    const trend = scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0;

    if (avg >= 80) {
      insights.push(\`Excellent \${category} skills! Keep up the great work.\`);
    } else if (avg >= 60) {
      insights.push(\`Good \${category} performance with room for improvement.\`);
    } else if (avg >= 40) {
      insights.push(\`\${category} needs attention. Focus on practice.\`);
    } else {
      insights.push(\`\${category} requires significant improvement.\`);
    }

    if (trend > 10) {
      insights.push('📈 Strong upward trend in recent sessions');
    } else if (trend < -10) {
      insights.push('📉 Performance has declined. Review fundamentals.');
    } else {
      insights.push('Consistent performance across sessions');
    }

    // Category-specific insights
    switch (category) {
      case 'technical':
        if (avg < 70) insights.push('💡 Tip: Review core concepts and practice more technical questions');
        break;
      case 'coding':
        if (avg < 70) insights.push('💡 Tip: Practice algorithmic problems on LeetCode or HackerRank');
        break;
      case 'communication':
        if (avg < 70) insights.push('💡 Tip: Practice the STAR method for behavioral questions');
        break;
      case 'bodyLanguage':
        if (avg < 70) insights.push('💡 Tip: Maintain eye contact and sit upright during interviews');
        break;
    }

    return insights;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500 dark:text-green-400';
    if (score >= 60) return 'text-yellow-500 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-500 dark:text-orange-400';
    return 'text-red-500 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your improvement plan...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
        <div className="container mx-auto px-4 py-8">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            className="mb-6 text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 border border-gray-200 dark:border-gray-700">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                No Data Yet
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                Complete an interview to generate your personalized improvement roadmap!
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => router.push('/interview/setup')}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Start Mock Interview
                </Button>
                <Button
                  onClick={() => router.push('/gd-room')}
                  variant="outline"
                  className="border-gray-300 dark:border-gray-600"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Join Group Discussion
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          className="mb-6 text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Your Improvement Plan
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Based on {sessions.length} interview session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={\`w-12 h-12 bg-gradient-to-br \${metric.color} rounded-xl flex items-center justify-center text-white\`}>
                  {metric.icon}
                </div>
                <div className={\`text-3xl font-bold \${getScoreColor(metric.score)}\`}>
                  {metric.score}%
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {metric.title}
              </h3>
              <div className="space-y-2">
                {metric.insights.map((insight, i) => (
                  <p key={i} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {insight}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Session History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Recent Sessions
          </h2>
          <div className="space-y-3">
            {sessions.slice(-5).reverse().map((session, idx) => (
              <div
                key={session.id || idx}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {session.type === 'mock' ? '🎤 Mock Interview' : '👥 Group Discussion'}
                  </p>
                  {session.company && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {session.company} - {session.role}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {new Date(session.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {session.scores && (
                  <div className="flex gap-3">
                    {session.scores.technical !== undefined && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tech</p>
                        <p className={\`font-bold \${getScoreColor(session.scores.technical)}\`}>
                          {Math.round(session.scores.technical)}
                        </p>
                      </div>
                    )}
                    {session.scores.communication !== undefined && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Comm</p>
                        <p className={\`font-bold \${getScoreColor(session.scores.communication)}\`}>
                          {Math.round(session.scores.communication)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

try {
  fs.writeFileSync(filePath, fileContent, 'utf8');
  console.log('✓ File created successfully:', filePath);
  console.log('\n✅ All done! The improvement page has been created.');
  process.exit(0);
} catch (error) {
  console.error('✗ Error creating file:', error.message);
  process.exit(1);
}
`;
