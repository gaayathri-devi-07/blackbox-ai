// Evaluation Engine Types
export interface EvaluationRequest {
  userId: string;
  sessionId: string;
  transcript: Array<{ role: string; content: string }>;
  context: {
    company: string;
    role: string;
    experience: string;
    resumeText?: string;
  };
}

export interface QuestionEvaluation {
  question: string;
  userAnswer: string;
  accuracyScore: number; // 0-100
  idealAnswer: string;
  comparison: {
    strengths: string[];
    missingPoints: string[];
    weakAreas: string[];
  };
  improvements: string[];
  jobWinningTips: string[];
}

export interface OverallEvaluation {
  sessionId: string;
  overallScore: number; // 0-100
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  questionEvaluations: QuestionEvaluation[];
  summary: {
    topStrengths: string[];
    criticalImprovements: string[];
    readinessLevel: "Needs Work" | "Getting There" | "Interview Ready" | "Exceptional";
  };
  nextSteps: string[];
}

export function buildEvaluationPrompt(request: EvaluationRequest): string {
  const { transcript, context } = request;
  
  const conversationText = transcript
    .map((msg) => `${msg.role === "user" ? "Candidate" : "Interviewer"}: ${msg.content}`)
    .join("\n\n");

  return `You are an expert interview coach evaluating a mock interview session.

## Interview Context
- Company: ${context.company}
- Role: ${context.role}
- Experience Level: ${context.experience}
${context.resumeText ? `- Resume Context: ${context.resumeText.substring(0, 500)}...` : ""}

## Interview Transcript
${conversationText}

## Your Task
Analyze this interview and return a STRICT JSON object with the following structure:

{
  "overallScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "confidenceScore": <number 0-100>,
  "questionEvaluations": [
    {
      "question": "The interviewer's question",
      "userAnswer": "The candidate's answer",
      "accuracyScore": <number 0-100>,
      "idealAnswer": "A professional, structured, job-winning response",
      "comparison": {
        "strengths": ["✅ Specific strength 1", "✅ Specific strength 2"],
        "missingPoints": ["❌ Missing point 1", "❌ Missing point 2"],
        "weakAreas": ["⚠️ Weak area 1", "⚠️ Weak area 2"]
      },
      "improvements": ["Actionable improvement 1", "Actionable improvement 2"],
      "jobWinningTips": ["Psychological/industry tip 1", "Psychological/industry tip 2"]
    }
  ],
  "summary": {
    "topStrengths": ["Top strength 1", "Top strength 2", "Top strength 3"],
    "criticalImprovements": ["Critical improvement 1", "Critical improvement 2"],
    "readinessLevel": "Needs Work" | "Getting There" | "Interview Ready" | "Exceptional"
  },
  "nextSteps": ["Next step 1", "Next step 2", "Next step 3"]
}

## Evaluation Criteria
1. **Accuracy Score**: Based on technical accuracy, relevance, and completeness
2. **Ideal Answer**: What a senior professional would say (use STAR method where applicable)
3. **Comparison**: Highlight SPECIFIC strengths (green), missing points (red), weak areas (orange)
4. **Improvements**: Actionable tips on phrasing, structure, and keywords
5. **Job Winning Tips**: Industry-specific or psychological insights

Return ONLY valid JSON. No markdown, no backticks, no explanations.`;
}
