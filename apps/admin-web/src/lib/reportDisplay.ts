export function formatReportResult(result: 'passed' | 'failed' | null | undefined): string {
  if (result === 'passed') return 'Passed';
  if (result === 'failed') return 'Failed';
  return '—';
}

export function formatAttemptFraction(attemptNumber: number, maxAttempts: number): string {
  return `${attemptNumber}/${maxAttempts}`;
}
