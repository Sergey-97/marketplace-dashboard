// backend/src/jobs/sync.cron.js
const cron = require('node-cron');
const { addSyncJob } = require('./sync.queue');

/**
 * Получить дату N дней назад
 */
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Запланировать ежедневную синхронизацию
 */
function scheduleDailySync() {
  // Запуск каждый день в 03:00 UTC
  cron.schedule('0 3 * * *', async () => {
    console.log('🕐 Запуск ежедневной синхронизации...');
    
    const dateTo = getDateDaysAgo(1); // Вчера
    const dateFrom = getDateDaysAgo(30); // 30 дней назад

    try {
      // Добавляем задачи в очередь (приоритет: WB первым)
      await addSyncJob('wildberries', dateFrom, dateTo, 1);
      await addSyncJob('ozon', dateFrom, dateTo, 2);
      
      console.log('📋 Задачи синхронизации добавлены в очередь');
      
    } catch (error) {
      console.error('❌ Ошибка планирования синхронизации:', error.message);
    }
  });

  console.log('✅ Ежедневная синхронизация запланирована на 03:00 UTC');
}

/**
 * Запланировать полную синхронизацию за весь период
 * Будет запущена вручную через API endpoint
 */
async function runFullSync() {
  console.log('🔄 Запуск полной синхронизации...');
  
  const dateTo = getDateDaysAgo(1);
  const dateFrom = '2024-01-01'; // Начало года

  try {
    await addSyncJob('wildberries', dateFrom, dateTo, 1);
    await addSyncJob('ozon', dateFrom, dateTo, 2);
    
    console.log('📋 Полная синхронизация добавлена в очередь');
    return { success: true, message: 'Синхронизация запущена' };
    
  } catch (error) {
    console.error('❌ Ошибка полной синхронизации:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  scheduleDailySync,
  runFullSync
};