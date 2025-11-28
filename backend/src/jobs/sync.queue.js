const { Queue } = require('bullmq');
const redisClient = require('../config/redis');

const queueOptions = {
  connection: redisClient || undefined,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 24 * 3600 }
  }
};

let syncQueue = null;
let forecastQueue = null;

if (redisClient) {
  syncQueue = new Queue('marketplace-sync', queueOptions);
  forecastQueue = new Queue('forecast-generation', queueOptions);
  console.log('✅ Redis очереди созданы');
} else {
  console.log('⚠️ Используем memory fallback');
  
  // In-memory fallback с немедленным выполнением
  syncQueue = {
    async add(name, data, opts) {
      console.log(`📋 Memory queue: ${name}`, data);
      setImmediate(async () => {
        const { processSyncJob } = require('./sync.worker');
        try {
          await processSyncJob({ data });
        } catch (err) {
          console.error('❌ Memory queue error:', err);
        }
      });
      return { id: Date.now(), name, data, opts };
    }
  };
}

async function addSyncJob(marketplace, dateFrom, dateTo, priority = 1) {
  if (!syncQueue) throw new Error('Queue unavailable');

  const jobId = `sync-${marketplace}-${dateFrom}-${dateTo}`;
  // Исправлено: удаление предыдущей задачи
  if (syncQueue.getJob) {
    const prevJob = await syncQueue.getJob(jobId);
    if (prevJob) await prevJob.remove();
  }

  const job = await syncQueue.add(`sync-${marketplace}`, 
    { marketplace, dateFrom, dateTo }, 
    { priority, jobId }
  );

  console.log(`📋 Добавлена задача: ${job.id}`);
  return job;
}

module.exports = { syncQueue, forecastQueue, addSyncJob };