import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;

let judgeQueueInstance: Queue | null = null;

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

export function getJudgeQueue(): Queue | null {
  if (judgeQueueInstance) return judgeQueueInstance;
  
  const connection = getRedisConnection();
  if (!connection) {
    console.warn('REDIS_URL not configured - judge queue disabled');
    return null;
  }
  
  judgeQueueInstance = new Queue('judge', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
  
  return judgeQueueInstance;
}

// For backward compatibility
export const judgeQueue = {
  add: async (...args: Parameters<Queue['add']>) => {
    const queue = getJudgeQueue();
    if (!queue) {
      console.warn('Judge queue not available - code execution queuing skipped');
      return null;
    }
    return queue.add(...args);
  },
};
