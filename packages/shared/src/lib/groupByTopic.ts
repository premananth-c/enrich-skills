/** Label for questions with no tags (Phase 1 topic grouping). */
export const UNTAGGED_TOPIC = 'General';

/** Primary topic = first non-empty tag, else General. */
export function primaryTopic(tags: string[] | undefined | null): string {
  if (!tags?.length) return UNTAGGED_TOPIC;
  const normalized = tags.map((t) => t.trim()).filter(Boolean);
  return normalized[0] ?? UNTAGGED_TOPIC;
}

export interface TopicGroup<T> {
  topic: string;
  items: T[];
}

/** Preserve overall item order; topic sections appear in first-seen order. */
export function groupByPrimaryTopic<T>(
  items: T[],
  getTags: (item: T) => string[] | undefined | null
): TopicGroup<T>[] {
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const topic = primaryTopic(getTags(item));
    if (!map.has(topic)) {
      map.set(topic, []);
      order.push(topic);
    }
    map.get(topic)!.push(item);
  }
  return order.map((topic) => ({ topic, items: map.get(topic)! }));
}

export interface TopicAiStats {
  total: number;
  ready: number;
  pending: number;
  failed: number;
}

export function computeTopicAiStats(
  subs: Array<{ aiReviewStatus?: string | null; aiReview?: unknown | null }>
): TopicAiStats {
  let ready = 0;
  let pending = 0;
  let failed = 0;
  for (const s of subs) {
    const st = s.aiReviewStatus;
    if (st === 'failed') {
      failed++;
    } else if (st === 'ready' && s.aiReview) {
      ready++;
    } else if (st === 'queued' || st === 'generating' || !st) {
      pending++;
    } else if (s.aiReview) {
      ready++;
    } else {
      pending++;
    }
  }
  return { total: subs.length, ready, pending, failed };
}

export function formatTopicAiStatsLine(stats: TopicAiStats): string {
  if (stats.total === 0) return '';
  const parts: string[] = [];
  if (stats.ready > 0) parts.push(`${stats.ready} ready`);
  if (stats.pending > 0) parts.push(`${stats.pending} in progress`);
  if (stats.failed > 0) parts.push(`${stats.failed} failed`);
  if (parts.length === 0) return `${stats.total} coding question${stats.total === 1 ? '' : 's'}`;
  return parts.join(' · ');
}
