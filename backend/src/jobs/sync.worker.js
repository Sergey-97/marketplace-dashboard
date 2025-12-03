const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const OzonAPI = require('../services/ozon.api');
const WBAPI = require('../services/wb.api');
const supabase = require('../config/supabase');

async function processSyncJob(job) {
  const { marketplace, dateFrom, dateTo } = job.data;
  console.log(`🔄 Синхронизация ${marketplace}: ${dateFrom} - ${dateTo}`);

  try {
    const rawData = marketplace === 'ozon' 
      ? await OzonAPI.getOrders(dateFrom, dateTo)
      : await WBAPI.getSales(dateFrom, dateTo);

    const formattedData = marketplace === 'ozon'
      ? rawData.flatMap(order => OzonAPI.formatOrder(order))
      : rawData.map(sale => WBAPI.formatSale(sale)).filter(Boolean);

    if (formattedData.length === 0) {
      console.log(`ℹ️ Нет данных для ${marketplace}`);
      return { success: true, inserted: 0 };
    }

    // Предотвращаем дубликаты
    const orderIds = formattedData.map(d => d.order_id);
    const { data: existing } = await supabase
      .from('sales_fact')
      .select('order_id')
      .in('order_id', orderIds);

    const existingIds = new Set(existing?.map(e => e.order_id) || []);
    const newData = formattedData.filter(d => !existingIds.has(d.order_id));

    if (newData.length === 0) {
      console.log(`ℹ️ Все ${formattedData.length} записей уже есть`);
      return { success: true, inserted: 0, duplicates: formattedData.length };
    }

    const { data, error } = await supabase
      .from('sales_fact')
      .insert(newData)
      .select();

    if (error) throw error;

    console.log(`✅ ${marketplace}: +${data.length} записей (${formattedData.length - newData.length} дубликатов)`);
    return { success: true, inserted: data.length, duplicates: formattedData.length - newData.length };

  } catch (error) {
    console.error(`❌ Ошибка ${marketplace}:`, error.message);
    throw error;
  }
}

let syncWorker = null;

if (redisClient) {
  try {
    syncWorker = new Worker('marketplace-sync', processSyncJob, {
      connection: redisClient,
      concurrency: 1,
      limiter: { max: 30, duration: 60000 }
    });

    syncWorker.on('completed', (job, result) => {
      console.log(`✅ Задача ${job.id} завершена:`, result);
    });

    syncWorker.on('failed', (job, err) => {
      console.error(`❌ Задача ${job.id} провалена:`, err.message);
    });

    console.log('✅ Worker запущен с Redis');
  } catch (error) {
    console.error('❌ Ошибка Worker:', error.message);
  }
} else {
  console.log('⚠️ Worker не запущен (нет Redis)');
}

module.exports = { syncWorker };

// Экспорт processSyncJob для возможности in-process fallback
module.exports.processSyncJob = processSyncJob;