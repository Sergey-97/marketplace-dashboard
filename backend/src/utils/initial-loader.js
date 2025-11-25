// backend/src/utils/initial-loader.js
const { addSyncJob } = require('../jobs/sync.queue');

/**
 * Загрузить данные за весь период по частям
 * Чтобы не перегружать API и не превышать лимиты
 */
async function loadAllHistory() {
  console.log('📚 Загрузка всей истории...');
  
  const startDate = new Date('2024-01-01');
  const endDate = new Date();
  const chunkDays = 7; // Загружать по недельным блокам
  
  const jobs = [];
  
  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + chunkDays)) {
    const chunkStart = d.toISOString().split('T')[0];
    const chunkEnd = new Date(Math.min(d.getTime() + chunkDays * 24 * 60 * 60 * 1000, endDate.getTime()))
      .toISOString().split('T')[0];
    
    console.log(`📅 Период: ${chunkStart} - ${chunkEnd}`);
    
    // Добавляем с задержкой (чтобы не перегрузить очередь)
    jobs.push(addSyncJob('wildberries', chunkStart, chunkEnd, 1));
    jobs.push(addSyncJob('ozon', chunkStart, chunkEnd, 2));
    
    // Пауза между блоками
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  await Promise.allSettled(jobs);
  console.log('✅ Все блоки истории добавлены в очередь');
}

module.exports = { loadAllHistory };