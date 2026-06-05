export interface SubmissionTimingInput {
  questionId: string;
  code: string | null;
  codeSubmittedAt: Date | string | null;
  updatedAt: Date | string;
}

export interface QuestionTiming {
  questionId: string;
  timeSpentSeconds: number;
}

export function getSubmissionSubmitTime(sub: SubmissionTimingInput): Date | null {
  if (sub.codeSubmittedAt) return new Date(sub.codeSubmittedAt);
  if (sub.code?.trim()) return new Date(sub.updatedAt);
  return null;
}

/** Time spent per question = gap between consecutive code submissions (first uses attempt start). */
export function computeQuestionTimings(
  attemptStartedAt: Date | string,
  submissions: SubmissionTimingInput[]
): QuestionTiming[] {
  const startMs = new Date(attemptStartedAt).getTime();
  const ordered = submissions
    .map((s) => ({ ...s, submitAt: getSubmissionSubmitTime(s) }))
    .filter((s): s is SubmissionTimingInput & { submitAt: Date } => s.submitAt != null)
    .sort((a, b) => a.submitAt.getTime() - b.submitAt.getTime());

  let prevMs = startMs;
  return ordered.map((s) => {
    const submitMs = s.submitAt.getTime();
    const seconds = Math.max(0, Math.round((submitMs - prevMs) / 1000));
    prevMs = submitMs;
    return { questionId: s.questionId, timeSpentSeconds: seconds };
  });
}

export function computeTotalTestSeconds(
  startedAt: Date | string,
  submittedAt: Date | string | null | undefined
): number | null {
  if (!submittedAt) return null;
  const ms = new Date(submittedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return secs > 0 ? `${hours}h ${minutes}m ${secs}s` : minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}

export function timingByQuestionId(timings: QuestionTiming[]): Map<string, number> {
  return new Map(timings.map((t) => [t.questionId, t.timeSpentSeconds]));
}
