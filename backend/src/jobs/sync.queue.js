// backend/src/jobs/sync.queue.js
const { Queue, Worker, Job } = require('bullmq');
const redisClient = require('../config/redis');

// Настройки очередей
const queueOptions = {
  connection: redisClient || undefined, // Если Redis нет, используем память
  defaultJobOptions: {
    attempts: 3, // 3 попытки
    backoff: {
      type: 'exponential',
      delay: 5000 // Начальная задержка 5 сек
    },
    removeOnComplete: { age: 3600 }, // Удалять через час
    removeOnFail: { age: 24 * 3600 } // Удалять через сутки
  }
};

// Очереди
const syncQueue = new Queue('marketplace-sync', queueOptions);
const forecastQueue = new Queue('forecast-generation', queueOptions);

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
  addForecastJob
};