// backend/src/jobs/sync.worker.js
const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const OzonAPI = require('../services/ozon.api');
const WBAPI = require('../services/wb.api');
const supabase = require('../config/supabase');

// Функция для обработки задачи синхронизации
async function processSyncJob(job) {
  const { marketplace, dateFrom, dateTo } = job.data;
  
  console.log(`🔄 Начата синхронизация ${marketplace}, период: ${dateFrom} - ${dateTo}`);
  
  let rawData = [];
  let formattedData = [];

  try {
    if (marketplace === 'ozon') {
      rawData = await OzonAPI.getOrders(dateFrom, dateTo);
      formattedData = rawData.flatMap(order => OzonAPI.formatOrder(order));
    } else if (marketplace === 'wildberries') {
      rawData = await WBAPI.getSales(dateFrom, dateTo);
      formattedData = rawData.map(sale => WBAPI.formatSale(sale)).filter(Boolean);
    }

    if (formattedData.length === 0) {
      console.log(`ℹ️  Нет данных для синхронизации ${marketplace}`);
      return { success: true, inserted: 0 };
    }

    // Bulk insert с обработкой дубликатов
    const { data, error } = await supabase
      .from('sales_fact')
      .insert(formattedData, {
        onConflict: 'order_id',
        ignoreDuplicates: true
      })
      .select();

    if (error) {
      console.error(`❌ Ошибка вставки данных ${marketplace}:`, error.message);
      throw error;
    }

    console.log(`✅ Синхронизация ${marketplace} завершена: ${data.length} записей`);
    
    return { success: true, inserted: data.length };

  } catch (error) {
    console.error(`❌ Критическая ошибка синхронизации ${marketplace}:`, error.message);
    throw error; // Worker автоматически повторит задачу
  }
}

// Создаем worker'ов
const syncWorker = new Worker(
  'marketplace-sync',
  async job => processSyncJob(job),
  {
    connection: redisClient || undefined,
    concurrency: 1, // Обрабатываем по одной задаче (важно для rate limiting)
    limiter: {
      max: 30, // 30 задач в минуту для OZON
      duration: 60000
    }
  }
);

syncWorker.on('completed', (job, result) => {
  console.log(`✅ Задача ${job.id} завершена:`, result);
});

syncWorker.on('failed', (job, err) => {
  console.error(`❌ Задача ${job.id} провалена:`, err.message);
});

module.exports = { syncWorker };