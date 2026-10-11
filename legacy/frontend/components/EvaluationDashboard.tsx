"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { OverallEvaluation, QuestionEvaluation } from "@/lib/evaluation-types";

interface EvaluationDashboardProps {
  evaluation: OverallEvaluation;
}

export default function EvaluationDashboard({ evaluation }: EvaluationDashboardProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);

  const getReadinessColor = (level: string) => {
    switch (level) {
      case "Exceptional":
        return "from-green-600 to-emerald-600";
      case "Interview Ready":
        return "from-blue-600 to-cyan-600";
      case "Getting There":
        return "from-yellow-600 to-orange-600";
      default:
        return "from-red-600 to-pink-600";
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section - Animated Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-black mb-4">Interview Evaluation</h1>
          
          {/* Circular Progress */}
          <div className="relative w-48 h-48 mx-auto mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="12"
                fill="none"
              />
              <motion.circle
                cx="96"
                cy="96"
                r="88"
                stroke="url(#scoreGradient)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 88}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 88 * (1 - evaluation.overallScore / 100),
                }}
                transition={{ duration: 2, ease: "easeOut" }}
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="text-center"
              >
                <div className="text-5xl font-black">{evaluation.overallScore}%</div>
                <div className="text-sm text-white/60">Overall Score</div>
              </motion.div>
            </div>
          </div>

          {/* Readiness Level */}
          <div
            className={`inline-block px-6 py-3 rounded-full bg-gradient-to-r ${getReadinessColor(
              evaluation.summary.readinessLevel
            )} text-white font-bold text-lg`}
          >
            {evaluation.summary.readinessLevel}
          </div>
        </motion.div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { label: "Technical", score: evaluation.technicalScore },
            { label: "Communication", score: evaluation.communicationScore },
            { label: "Confidence", score: evaluation.confidenceScore },
          ].map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 * idx }}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center"
            >
              <div className="text-3xl font-bold mb-2">{item.score}%</div>
              <div className="text-sm text-white/60">{item.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Top Strengths & Improvements */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Top Strengths
            </h3>
            <ul className="space-y-2">
              {evaluation.summary.topStrengths.map((strength, idx) => (
                <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✅</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20">
            <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Critical Improvements
            </h3>
            <ul className="space-y-2">
              {evaluation.summary.criticalImprovements.map((improvement, idx) => (
                <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">❌</span>
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Question-by-Question Breakdown */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Question-by-Question Analysis</h2>
          <div className="space-y-4">
            {evaluation.questionEvaluations.map((qEval, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-white/5 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl font-bold text-purple-400">Q{idx + 1}</div>
                      <div className="text-white/60 flex-1 line-clamp-1">{qEval.question}</div>
                      <div className="text-xl font-bold">{qEval.accuracyScore}%</div>
                    </div>
                  </div>
                  {expandedQuestion === idx ? (
                    <ChevronUp className="w-5 h-5 text-white/40" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/40" />
                  )}
                </button>

                {expandedQuestion === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="border-t border-white/10 p-6 space-y-6"
                  >
                    {/* Your Answer */}
                    <div>
                      <h4 className="text-sm font-semibold text-white/60 mb-2">Your Answer:</h4>
                      <p className="text-white/80 text-sm leading-relaxed">{qEval.userAnswer}</p>
                    </div>

                    {/* Ideal Answer */}
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Ideal Answer:</h4>
                      <p className="text-white/80 text-sm leading-relaxed">{qEval.idealAnswer}</p>
                    </div>

                    {/* Comparison */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-green-400 mb-2">Strengths</h4>
                        <ul className="space-y-1">
                          {qEval.comparison.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-white/70">{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-red-400 mb-2">Missing</h4>
                        <ul className="space-y-1">
                          {qEval.comparison.missingPoints.map((m, i) => (
                            <li key={i} className="text-xs text-white/70">{m}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-orange-400 mb-2">Weak Areas</h4>
                        <ul className="space-y-1">
                          {qEval.comparison.weakAreas.map((w, i) => (
                            <li key={i} className="text-xs text-white/70">{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Job Winning Tips */}
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <h4 className="text-sm font-semibold text-purple-400 mb-2">💡 Job-Winning Tips:</h4>
                      <ul className="space-y-1">
                        {qEval.jobWinningTips.map((tip, i) => (
                          <li key={i} className="text-xs text-white/70">{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30">
          <h2 className="text-2xl font-bold mb-4">🎯 Next Steps</h2>
          <ul className="space-y-3">
            {evaluation.nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <p className="text-white/90">{step}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
