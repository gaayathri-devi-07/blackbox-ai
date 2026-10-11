const fs = require('fs');
const path = require('path');

// Set the base directory
const baseDir = 'C:\\Users\\gaaya\\blackbox-ai';
const projectDir = path.join(baseDir, 'frontend', 'app', 'journey', 'improvement');

console.log('Creating directory:', projectDir);

// Ensure directory exists
try {
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
    console.log('✓ Directory created successfully');
  } else {
    console.log('✓ Directory already exists');
  }
} catch (error) {
  console.error('✗ Error creating directory:', error.message);
  process.exit(1);
}

// Create the page.tsx file with exact content
const filePath = path.join(projectDir, 'page.tsx');

const fileContent = `'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, Trophy, Target, Brain, Zap, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function ImprovementPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    interviewsTaken: 0,
    practiceQuestions: 0,
    projectsAnalyzed: 0,
    overallScore: 0,
  });

  useEffect(() => {
    try {
      // Aggregate data from localStorage
      let mockCount = 0;
      let gdCount = 0;
      let practiceCount = 0;
      let projectCount = 0;
      let totalScore = 0;
      let scoreCount = 0;

      // Mock interviews
      const mockResults = localStorage.getItem('mockResults');
      if (mockResults) {
        try {
          const parsed = JSON.parse(mockResults);
          if (Array.isArray(parsed)) {
            mockCount = parsed.length;
            parsed.forEach(result => {
              if (result.scores?.overall) {
                totalScore += result.scores.overall;
                scoreCount++;
              }
            });
          } else if (parsed.scores) {
            mockCount = 1;
            if (parsed.scores.overall) {
              totalScore += parsed.scores.overall;
              scoreCount++;
            }
          }
        } catch (e) {
          console.error('Error parsing mockResults:', e);
        }
      }

      // GD sessions
      const gdResults = localStorage.getItem('gdResults');
      if (gdResults) {
        try {
          const parsed = JSON.parse(gdResults);
          if (Array.isArray(parsed)) {
            gdCount = parsed.length;
            parsed.forEach(result => {
              if (result.scores?.overall) {
                totalScore += result.scores.overall;
                scoreCount++;
              }
            });
          } else if (parsed.scores) {
            gdCount = 1;
            if (parsed.scores.overall) {
              totalScore += parsed.scores.overall;
              scoreCount++;
            }
          }
        } catch (e) {
          console.error('Error parsing gdResults:', e);
        }
      }

      // Interview session history
      const sessionHistory = localStorage.getItem('interviewSessionHistory');
      if (sessionHistory) {
        try {
          const parsed = JSON.parse(sessionHistory);
          if (Array.isArray(parsed)) {
            parsed.forEach(session => {
              if (session.type === 'mock') mockCount++;
              else if (session.type === 'gd') gdCount++;
              
              if (session.scores?.overall) {
                totalScore += session.scores.overall;
                scoreCount++;
              }
            });
          }
        } catch (e) {
          console.error('Error parsing sessionHistory:', e);
        }
      }

      // Practice questions
      const practiceHistory = localStorage.getItem('practiceHistory');
      if (practiceHistory) {
        try {
          const parsed = JSON.parse(practiceHistory);
          if (Array.isArray(parsed)) {
            practiceCount = parsed.length;
          } else if (typeof parsed === 'object') {
            practiceCount = Object.keys(parsed).length;
          }
        } catch (e) {
          console.error('Error parsing practiceHistory:', e);
        }
      }

      // Project analyses
      const projectHistory = localStorage.getItem('projectHistory');
      if (projectHistory) {
        try {
          const parsed = JSON.parse(projectHistory);
          if (Array.isArray(parsed)) {
            projectCount = parsed.length;
          }
        } catch (e) {
          console.error('Error parsing projectHistory:', e);
        }
      }

      // Calculate overall score
      let overallScore = 0;
      if (scoreCount > 0) {
        overallScore = Math.round(totalScore / scoreCount);
      } else {
        // Generate baseline score based on activity
        const activityScore = Math.min(100, (mockCount * 10) + (gdCount * 10) + (practiceCount * 2) + (projectCount * 5));
        overallScore = Math.max(78, activityScore); // Minimum 78 for active users
      }

      setStats({
        interviewsTaken: mockCount + gdCount,
        practiceQuestions: practiceCount,
        projectsAnalyzed: projectCount,
        overallScore: Math.min(100, overallScore),
      });
    } catch (error) {
      console.error('Failed to load improvement plan data:', error);
      // Set baseline defaults
      setStats({
        interviewsTaken: 0,
        practiceQuestions: 0,
        projectsAnalyzed: 0,
        overallScore: 78,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'from-green-500 to-emerald-500';
    if (score >= 75) return 'from-blue-500 to-cyan-500';
    if (score >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getScoreGlow = (score: number): string => {
    if (score >= 90) return 'shadow-green-500/50';
    if (score >= 75) return 'shadow-blue-500/50';
    if (score >= 60) return 'shadow-yellow-500/50';
    return 'shadow-red-500/50';
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Your Performance Dashboard
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Track your progress and master your interview skills
          </p>
        </motion.div>

        {/* Overall Score - Hero Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className={\`relative bg-white dark:bg-white/5 rounded-3xl p-12 border-2 border-gray-200 dark:border-white/10 shadow-2xl \${getScoreGlow(stats.overallScore)} overflow-hidden\`}>
            {/* Background gradient */}
            <div className="absolute inset-0 opacity-10">
              <div className={\`absolute inset-0 bg-gradient-to-br \${getScoreColor(stats.overallScore)}\`}></div>
            </div>
            
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium uppercase tracking-wider">
                  Overall Skill Score
                </p>
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </div>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="relative inline-block"
              >
                <div className={\`text-9xl font-black bg-gradient-to-br \${getScoreColor(stats.overallScore)} bg-clip-text text-transparent\`}>
                  {stats.overallScore}
                </div>
                <div className="text-4xl font-bold text-gray-400 dark:text-gray-500 inline-block ml-2">
                  /100
                </div>
              </motion.div>
              
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className={\`h-3 bg-gradient-to-r \${getScoreColor(stats.overallScore)} rounded-full\`} 
                     style={{ width: \`\${Math.max(200, stats.overallScore * 3)}px\` }}>
                </div>
              </div>
              
              <p className="mt-6 text-xl text-gray-700 dark:text-gray-300 font-medium">
                {stats.overallScore >= 90 ? "🏆 Outstanding Performance!" : 
                 stats.overallScore >= 75 ? "🎯 Excellent Progress!" :
                 stats.overallScore >= 60 ? "💪 Good Work!" :
                 "📈 Keep Going!"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid - 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Interviews Completed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-white/5 rounded-2xl p-8 border border-gray-200 dark:border-white/10 shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <span className="text-4xl">🎤</span>
            </div>
            <div className="text-5xl font-black text-gray-900 dark:text-white mb-2">
              {stats.interviewsTaken}
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Interviews Completed
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mock interviews & group discussions
            </p>
          </motion.div>

          {/* Practice Questions Mastered */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-white/5 rounded-2xl p-8 border border-gray-200 dark:border-white/10 shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <span className="text-4xl">📝</span>
            </div>
            <div className="text-5xl font-black text-gray-900 dark:text-white mb-2">
              {stats.practiceQuestions}
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Practice Questions
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mastered in Practice Hub
            </p>
          </motion.div>

          {/* Project AI Analyses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-white/5 rounded-2xl p-8 border border-gray-200 dark:border-white/10 shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <span className="text-4xl">💻</span>
            </div>
            <div className="text-5xl font-black text-gray-900 dark:text-white mb-2">
              {stats.projectsAnalyzed}
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Project AI Analyses
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Projects reviewed & improved
            </p>
          </motion.div>
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl p-8 text-center text-white shadow-xl"
        >
          <Target className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">
            Keep Building Your Skills
          </h2>
          <p className="text-white/90 mb-6 max-w-2xl mx-auto">
            Every interview, practice session, and project analysis brings you closer to your dream job. 
            Keep up the momentum!
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              onClick={() => router.push('/interview/setup')}
              className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-6 py-3"
            >
              Start Mock Interview
            </Button>
            <Button
              onClick={() => router.push('/journey/practice')}
              variant="outline"
              className="border-white text-white hover:bg-white/20 font-semibold px-6 py-3"
            >
              Practice Questions
            </Button>
            <Button
              onClick={() => router.push('/journey/project')}
              variant="outline"
              className="border-white text-white hover:bg-white/20 font-semibold px-6 py-3"
            >
              Analyze Project
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
`;

// Write the file
try {
  fs.writeFileSync(filePath, fileContent, 'utf8');
  console.log('✓ File created successfully:', filePath);
  console.log('✓ File size:', fs.statSync(filePath).size, 'bytes');
  
  // Verify the file was created
  if (fs.existsSync(filePath)) {
    console.log('✓ File verified to exist');
    console.log('\n✅ SUCCESS: Improvement page has been created with exact content!');
    process.exit(0);
  } else {
    console.error('✗ File creation failed - file does not exist');
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Error writing file:', error.message);
  process.exit(1);
}
