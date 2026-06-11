import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  aiCareerReviewPayloadSchema,
  computeQuestionTimings,
  computeTotalTestSeconds,
  formatDuration,
  primaryTopic,
  timingByQuestionId,
  type AiAttemptReviewPayload,
  type AiReviewPayload,
} from '@enrich-skills/shared';
import { openRouterChatWithFallback } from './openrouter.js';

const prisma = new PrismaClient();
const MAX_CODE_CHARS = 2000;

interface CareerReviewJobData {
  userId: string;
}

function truncateCode(code: string): string {
  if (code.length <= MAX_CODE_CHARS) return code;
  return code.slice(0, MAX_CODE_CHARS) + '\n// ... truncated ...';
}

const CAREER_REVIEW_SYSTEM_PROMPT = `You are a senior engineering manager and technical career coach generating an industry-ready employability report for a college placement cell and the student.

You will receive a JSON payload of the student's coding test history: scores, languages, timing, per-question AI reviews, and code submissions.

Generate a rigorous, honest report that goes beyond pass/fail. Engineering managers care about technical depth, idiomatic language use, code quality, algorithmic efficiency, and role fit.

Respond with a single JSON object only (no markdown fences). Schema:
{
  "executiveSummary": string (4-6 sentences — placement-cell ready overview),
  "competencyScores": {
    "logic": number 1-10,
    "codeQuality": number 1-10,
    "speed": number 1-10,
    "languageVersatility": number 1-10
  },
  "languageAgility": {
    "versatilityScore": number 1-10,
    "versatilityJustification": string,
    "paradigmEvaluation": string (idiomatic vs C-style translation across languages),
    "languageProficiency": [{
      "language": string,
      "fluencyScore": number 1-10,
      "proficiencyLevel": string (e.g. Fluent, Intermediate, Beginner),
      "idiomaticUsage": string,
      "paradigmNotes": string
    }],
    "coreCsConcepts": {
      "dataStructures": string (arrays, hash maps, trees, etc.),
      "algorithms": string (sorting, DP, greedy, etc.)
    }
  },
  "codeQuality": {
    "readabilityAndMaintainability": string,
    "namingConventions": string,
    "modularity": string,
    "robustnessAndEdgeCases": string (null, empty, boundaries, hidden cases),
    "codeSmells": string[] (2-6 specific anti-patterns),
    "bestPractices": string
  },
  "algorithmicEfficiency": {
    "summary": string,
    "problemAnalyses": [{
      "problemTitle": string,
      "language": string,
      "timeComplexity": string (Big-O notation),
      "spaceComplexity": string (Big-O notation),
      "optimizationGap": string (exact gap vs optimal, e.g. nested loop O(n^2) vs hash map O(n)),
      "optimizationScore": number 1-10
    }]
  },
  "behavioralPatterns": {
    "debuggingEfficiency": string (infer from submission patterns if limited data, state assumptions),
    "timeManagement": string (time per question vs difficulty — flag easy problems taking too long)
  },
  "industryFitment": {
    "employabilityTag": string (e.g. "Strong Backend Candidate"),
    "roleMappings": [{
      "role": string (Backend Developer, Data Engineer, Frontend/Fullstack Trainee, Systems Engineer, etc.),
      "fitLevel": "Strong" | "Moderate" | "Emerging",
      "rationale": string
    }],
    "skillGapAnalysis": string (what blocks technical interviews — be specific)
  },
  "fourWeekRoadmap": [{
    "week": number 1-4,
    "focus": string,
    "tasks": string[] (3-4 highly specific tasks — never generic "practice coding")
  }],
  "testsAnalyzed": number
}

Rules:
- Be specific: cite languages, problem types, and concrete gaps.
- Use timing data when provided for time management analysis.
- Use per-question AI scores and code when provided for quality/efficiency analysis.
- fourWeekRoadmap must have exactly 4 weeks with actionable tasks.`;

function buildCareerReviewUserPrompt(
  studentName: string,
  payload: unknown
): string {
  return `Student: ${studentName}

Analyze the following JSON payload containing this student's performance across multiple coding tests and languages.

${JSON.stringify(payload, null, 2)}

Generate the industry-ready employability report covering:
1. Language Agility & Paradigm Evaluation (versatility 1-10, idiomatic vs literal syntax)
2. Production Code Quality (naming, modularity, edge cases, code smells)
3. Algorithmic Efficiency Deep Dive (Time/Space Big-O per problem, optimization gap)
4. Industry Role Mapping & Fitment (personas with Strong/Moderate/Emerging)
5. Actionable 4-Week Skill Gap Roadmap (specific tasks, not generic advice)`;
}

export async function processCareerReview(job: Job<CareerReviewJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[AI Career Review] Processing user ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!user || user.role !== 'student') {
    console.warn(`[AI Career Review] User ${userId} not found or not a student`);
    return;
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      userId,
      status: { in: ['submitted', 'graded'] },
      test: { type: 'coding' },
      submissions: { some: { code: { not: null } } },
    },
    include: {
      test: { select: { title: true, config: true } },
      submissions: {
        include: {
          question: { select: { content: true, tags: true, difficulty: true, type: true } },
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });

  if (attempts.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiCareerReviewStatus: 'skipped', aiCareerReviewError: null },
    });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { aiCareerReviewStatus: 'generating', aiCareerReviewError: null },
  });

  try {
    const payloadAttempts = attempts.map((attempt) => {
      const codingSubs = attempt.submissions.filter(
        (s) => s.question.type === 'coding' && s.code?.trim()
      );
      const timingMap = timingByQuestionId(
        computeQuestionTimings(attempt.startedAt, codingSubs)
      );
      const languages = [
        ...new Set(codingSubs.map((s) => s.language).filter((l): l is string => Boolean(l))),
      ];
      const topics = codingSubs.map((s) => primaryTopic(s.question.tags));

      return {
        testTitle: attempt.test.title,
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        score: attempt.score,
        maxScore: attempt.maxScore,
        scorePercent:
          attempt.score != null && attempt.maxScore != null && attempt.maxScore > 0
            ? Math.round((attempt.score / attempt.maxScore) * 100)
            : null,
        totalTestSeconds: computeTotalTestSeconds(attempt.startedAt, attempt.submittedAt),
        totalTestFormatted:
          computeTotalTestSeconds(attempt.startedAt, attempt.submittedAt) != null
            ? formatDuration(
                computeTotalTestSeconds(attempt.startedAt, attempt.submittedAt)!
              )
            : null,
        languages,
        topics: [...new Set(topics)],
        overallReview:
          attempt.aiOverallReviewStatus === 'ready' && attempt.aiOverallReview
            ? (attempt.aiOverallReview as AiAttemptReviewPayload)
            : null,
        questions: codingSubs.map((s) => {
          const content = s.question.content as { title?: string; description?: string };
          const ai =
            s.aiReviewStatus === 'ready' && s.aiReview
              ? (s.aiReview as AiReviewPayload)
              : null;
          return {
            title: content.title ?? 'Coding question',
            topic: primaryTopic(s.question.tags),
            difficulty: s.question.difficulty,
            language: s.language,
            submissionStatus: s.status,
            passed: s.status === 'passed',
            timeSpentSeconds: timingMap.get(s.questionId) ?? null,
            timeSpentFormatted:
              timingMap.get(s.questionId) != null
                ? formatDuration(timingMap.get(s.questionId)!)
                : null,
            aiReview: ai
              ? {
                  summary: ai.overallSummary,
                  strengths: ai.strengths,
                  weaknesses: ai.weaknesses,
                  scores: ai.scores,
                }
              : null,
            code: s.code ? truncateCode(s.code) : null,
          };
        }),
      };
    });

    const userPrompt = buildCareerReviewUserPrompt(user.name, {
      studentName: user.name,
      testsAnalyzed: attempts.length,
      attempts: payloadAttempts,
    });

    const { content, model } = await openRouterChatWithFallback({
      messages: [
        { role: 'system', content: CAREER_REVIEW_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      jsonMode: true,
      temperature: 0.25,
      maxTokens: 4500,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('AI response was not valid JSON');
    }

    const validated = aiCareerReviewPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`AI response schema invalid: ${validated.error.message.slice(0, 400)}`);
    }

    const report = { ...validated.data, testsAnalyzed: attempts.length };

    await prisma.user.update({
      where: { id: userId },
      data: {
        aiCareerReview: report,
        aiCareerReviewStatus: 'ready',
        aiCareerReviewError: null,
        aiCareerReviewModel: model,
        aiCareerReviewGeneratedAt: new Date(),
        aiCareerReviewTestCount: attempts.length,
      },
    });

    console.log(`[AI Career Review] User ${userId} ready (${attempts.length} tests, model=${model})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isLastAttempt = (job.opts.attempts ?? 1) <= job.attemptsMade;

    if (isLastAttempt) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          aiCareerReviewStatus: 'failed',
          aiCareerReviewError: message.slice(0, 500),
        },
      });
      console.error(`[AI Career Review] User ${userId} failed:`, message);
    }
    throw err;
  }
}
