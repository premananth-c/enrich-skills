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

interface CareerReviewJobData {
  userId: string;
}

function buildCareerReviewPrompt(
  studentName: string,
  attempts: Array<{
    testTitle: string;
    submittedAt: Date | null;
    score: number | null;
    maxScore: number | null;
    totalTestSeconds: number | null;
    languages: string[];
    topics: string[];
    overallReview: AiAttemptReviewPayload | null;
    questionSummaries: Array<{
      title: string;
      topic: string;
      difficulty: string;
      status: string;
      timeSpentSeconds: number | null;
      aiSummary: string | null;
    }>;
  }>
): { system: string; user: string } {
  const blocks = attempts
    .map((a, i) => {
      const scorePct =
        a.score != null && a.maxScore != null && a.maxScore > 0
          ? `${Math.round((a.score / a.maxScore) * 100)}%`
          : '—';
      const qLines = a.questionSummaries
        .map(
          (q) =>
            `  - ${q.title} [${q.topic}/${q.difficulty}] ${q.status}${
              q.timeSpentSeconds != null ? `, ${formatDuration(q.timeSpentSeconds)}` : ''
            }${q.aiSummary ? `: ${q.aiSummary.slice(0, 200)}` : ''}`
        )
        .join('\n');
      const overall = a.overallReview
        ? `Overall test AI: ${a.overallReview.overallSummary}`
        : 'Overall test AI: not available';

      return `Test ${i + 1}: ${a.testTitle}
Submitted: ${a.submittedAt?.toISOString() ?? '—'}
Score: ${a.score ?? '—'}/${a.maxScore ?? '—'} (${scorePct})
Total time: ${a.totalTestSeconds != null ? formatDuration(a.totalTestSeconds) : '—'}
Languages: ${a.languages.join(', ') || '—'}
Topics: ${[...new Set(a.topics)].join(', ') || '—'}
${overall}
Questions:
${qLines}`;
    })
    .join('\n\n');

  const system = `You are a technical career coach comparing a student's performance across multiple coding assessments.
Synthesize cross-test patterns: strengths, weaknesses, improvement areas, and employability in the current job market.
Focus on languages/domains they have actually practiced. Be specific and actionable.
Respond with a single JSON object only (no markdown fences):
{
  "overallSummary": string (4-6 sentences comparing performance across tests),
  "languagesAndDomains": string[] (unique stacks/topics they have worked in),
  "strengths": string[] (4-8 recurring strengths),
  "weaknesses": string[] (4-8 recurring weaknesses),
  "improvementAreas": string[] (4-8 prioritized skill gaps),
  "additionalLearning": string[] (6-10 courses, projects, certs, topics for current hiring trends),
  "jobMarketOutlook": string (3-5 sentences on job readiness for their stack),
  "testsAnalyzed": number,
  "testInsights": [{ "testTitle": string, "languages": string[], "scoreSummary": string, "highlights": string }],
  "recommendations": string[] (6-10 concrete next steps)
}`;

  const user = `Student: ${studentName}
Coding tests completed (${attempts.length}):

${blocks}`;

  return { system, user };
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
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        maxScore: attempt.maxScore,
        totalTestSeconds: computeTotalTestSeconds(attempt.startedAt, attempt.submittedAt),
        languages,
        topics,
        overallReview:
          attempt.aiOverallReviewStatus === 'ready' && attempt.aiOverallReview
            ? (attempt.aiOverallReview as AiAttemptReviewPayload)
            : null,
        questionSummaries: codingSubs.map((s) => {
          const content = s.question.content as { title?: string };
          const ai = s.aiReview as AiReviewPayload | null;
          return {
            title: content.title ?? 'Coding question',
            topic: primaryTopic(s.question.tags),
            difficulty: s.question.difficulty,
            status: s.status,
            timeSpentSeconds: timingMap.get(s.questionId) ?? null,
            aiSummary: ai?.overallSummary ?? null,
          };
        }),
      };
    });

    const { system, user: userPrompt } = buildCareerReviewPrompt(user.name, payloadAttempts);

    const { content, model } = await openRouterChatWithFallback({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 2200,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('AI response was not valid JSON');
    }

    const validated = aiCareerReviewPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`AI response schema invalid: ${validated.error.message.slice(0, 300)}`);
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
