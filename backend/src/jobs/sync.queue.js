// backend/src/jobs/sync.queue.js
const { Queue } = require('bullmq');
const redisClient = require('../config/redis');
const MemoryQueue = require('./memory.queue');

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000
  },
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 24 * 3600 }
};

// Use Redis Queue if available, otherwise Memory Queue
const useRedis = !!redisClient;

const syncQueue = useRedis 
  ? new Queue('marketplace-sync', { connection: redisClient, defaultJobOptions: DEFAULT_JOB_OPTIONS })
  : new MemoryQueue('marketplace-sync');

const forecastQueue = useRedis
  ? new Queue('forecast-generation', { connection: redisClient, defaultJobOptions: DEFAULT_JOB_OPTIONS })
  : new MemoryQueue('forecast-generation');

// Функция добавления задачи синхронизации
async function addSyncJob(marketplace, dateFrom, dateTo, priority = 1) {
  const job = await syncQueue.add(
    `sync-${marketplace}`,
    { marketplace, dateFrom, dateTo },
    { priority, jobId: `sync-${marketplace}-${dateFrom}-${dateTo}` }
  );
  
  console.log(`📋 Добавлена задача синхронизации: ${job.id}`);
  return job;
}

// Функция добавления задачи прогноза
async function addForecastJob(article, monthsAhead = 3) {
  const job = await forecastQueue.add(
    `forecast-${article}`,
    { article, monthsAhead },
    { priority: 2 }
  );
  
  console.log(`📋 Добавлена задача прогноза: ${job.id}`);
  return job;
}

module.exports = {
  syncQueue,
  forecastQueue,
  addSyncJob,
  addForecastJob,
  useRedis // Export for conditional logic elsewhere
};