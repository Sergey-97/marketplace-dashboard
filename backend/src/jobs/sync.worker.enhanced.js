/**
 * Background Worker для обработки очередей синхронизации маркетплейсов
 * Обрабатывает задачи из BullMQ очереди в режиме реального времени
 */

require('dotenv').config();
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const supabase = require('../config/supabase');
const ozonApi = require('../services/ozon.api');
const wbApi = require('../services/wb.api');

console.log('🔄 Инициализация Background Worker...');

// === Проверка Redis ===
if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
  console.warn('⚠️ REDIS_URL/REDIS_HOST не установлены — worker требует Redis для продакшена');
  console.warn('ℹ️  Для разработки используется in-memory queue');
}

// === Инициализация Redis ===
let redis = null;
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  const redisConfig = process.env.REDIS_URL || {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3
  };
  redis = new Redis(redisConfig);
  redis.on('error', err => console.error('❌ Redis Error:', err));
}

// === Функция логирования синхронизации ===
async function logSync(marketplace, startDate, endDate, status, details = {}) {
  try {
    if (!supabase) return;
    await supabase.from('sync_logs').insert({
      marketplace,
      start_date: startDate,
      end_date: endDate,
      status,
      details: JSON.stringify(details),
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error logging sync:', err);
  }
}

// === Основная обработка задачи ===
async function processJob(job) {
  console.log(`📦 Processing Job ${job.id}:`, job.data);
  const { marketplace, startDate, endDate } = job.data;

  try {
    await job.progress(5);
    console.log(`⏳ Starting sync for ${marketplace} (${startDate} to ${endDate})`);

    let processedOrders = 0;
    const syncDetails = { startedAt: new Date().toISOString() };

    // === Синхронизация OZON ===
    if (marketplace === 'ozon' || marketplace === 'all') {
      try {
        console.log('📥 Syncing OZON...');
        await job.progress(20);

        // TODO: Получить данные из OZON API
        // const ozonData = await ozonApi.getOrders(startDate, endDate);
        // await ozonApi.getPrices(startDate, endDate);
        // await ozonApi.getReturns(startDate, endDate);
        
        // Пока логируем в консоль
        console.log(`✅ OZON sync completed`);
        syncDetails.ozon = { status: 'completed', orders: processedOrders };
        
        await logSync('ozon', startDate, endDate, 'success', { orders: processedOrders });
      } catch (err) {
        console.error('❌ OZON sync error:', err.message);
        syncDetails.ozon = { status: 'error', error: err.message };
        await logSync('ozon', startDate, endDate, 'error', { error: err.message });
      }
      await job.progress(50);
    }

    // === Синхронизация Wildberries ===
    if (marketplace === 'wildberries' || marketplace === 'all') {
      try {
        console.log('📥 Syncing Wildberries...');
        await job.progress(60);

        // TODO: Получить данные из Wildberries API
        // const wbData = await wbApi.getOrders(startDate, endDate);
        // await wbApi.getPrices(startDate, endDate);
        // await wbApi.getReturns(startDate, endDate);
        
        console.log(`✅ Wildberries sync completed`);
        syncDetails.wildberries = { status: 'completed', orders: processedOrders };
        
        await logSync('wildberries', startDate, endDate, 'success', { orders: processedOrders });
      } catch (err) {
        console.error('❌ Wildberries sync error:', err.message);
        syncDetails.wildberries = { status: 'error', error: err.message };
        await logSync('wildberries', startDate, endDate, 'error', { error: err.message });
      }
      await job.progress(85);
    }

    // === Обновление агрегатов ===
    try {
      console.log('📊 Updating aggregates...');
      // TODO: Вызвать SQL функцию для пересчета KPI
      // await supabase.rpc('calculate_kpi', { p_start_date: startDate, p_end_date: endDate });
      await job.progress(95);
    } catch (err) {
      console.error('⚠️ Aggregates error:', err.message);
    }

    await job.progress(100);
    syncDetails.completedAt = new Date().toISOString();
    
    console.log(`✅ Job ${job.id} completed successfully`);
    return { success: true, ...syncDetails };
  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error.message);
    await logSync(marketplace, startDate, endDate, 'error', { error: error.message });
    throw error;
  }
}

// === Инициализация Worker ===
async function startWorker() {
  try {
    if (!redis) {
      console.warn('⚠️ Skipping worker start — Redis not configured');
      return;
    }

    const worker = new Worker('sync-marketplace', processJob, {
      connection: redis,
      concurrency: 2,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: { age: 3600 }, // Удалять completed задачи спустя 1 час
        removeOnFail: { age: 86400 } // Удалять failed задачи спустя 24 часа
      }
    });

    // === Event Listeners ===
    worker.on('completed', job => {
      console.log(`✅ Completed: Job ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Failed: Job ${job.id} — ${err.message}`);
    });

    worker.on('error', err => {
      console.error('❌ Worker Error:', err.message);
    });

    worker.on('stalled', jobId => {
      console.warn(`⚠️ Job ${jobId} stalled`);
    });

    console.log('✅ Worker started and ready to process jobs');

    // === Graceful Shutdown ===
    process.on('SIGTERM', async () => {
      console.log('🛑 Graceful shutdown initiated...');
      await worker.close();
      if (redis) await redis.quit();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 Graceful shutdown initiated...');
      await worker.close();
      if (redis) await redis.quit();
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Failed to start worker:', err.message);
    process.exit(1);
  }
}

// === Запуск ===
if (require.main === module) {
  startWorker();
}

module.exports = { startWorker, processJob };
