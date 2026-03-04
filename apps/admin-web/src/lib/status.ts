const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress',
  not_started: 'Not Started',
  partially_submitted: 'Partially Submitted',
  submitted: 'Submitted',
  graded: 'Graded',
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  pass: 'Pass',
  fail: 'Fail',
  passed: 'Passed',
  failed: 'Failed',
};

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return '--';
  const normalized = status.trim().toLowerCase();
  if (!normalized) return '--';

  const known = STATUS_LABELS[normalized];
  if (known) return known;

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
