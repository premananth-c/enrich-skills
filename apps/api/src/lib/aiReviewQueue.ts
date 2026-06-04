import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;

let aiReviewQueueInstance: Queue | null = null;

function getRedisConnection() {
  if (!REDIS_URL) return null;
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
    };
  } catch {
    return null;
  }
}

export function getAiReviewQueue(): Queue | null {
  if (aiReviewQueueInstance) return aiReviewQueueInstance;

  const connection = getRedisConnection();
  if (!connection) {
    console.warn('REDIS_URL not configured - ai-review queue disabled');
    return null;
  }

  aiReviewQueueInstance = new Queue('ai-review', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  return aiReviewQueueInstance;
}

export const aiReviewQueue = {
  add: async (...args: Parameters<Queue['add']>) => {
    const queue = getAiReviewQueue();
    if (!queue) {
      console.warn('AI review queue not available - job skipped');
      return null;
    }
    return queue.add(...args);
  },
};
