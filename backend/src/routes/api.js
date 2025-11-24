// backend/src/routes/api.js
const express = require('express');
const router = express.Router();
const DataController = require('../controllers/data.controller');
const { addSyncJob } = require('../jobs/sync.queue');
const { processSyncJob } = require('../jobs/sync.worker');

// ... другие маршруты ...

// Управление синхронизацией
router.post('/sync/trigger', async (req, res) => {
  try {
    const { marketplace, dateFrom, dateTo } = req.body;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom и dateTo обязательны' });
    }
    
    // Если Redis не настроен, выполняем синхронизацию напрямую
    if (!process.env.REDIS_HOST) {
      console.log('⚠️  Redis не настроен, выполняем синхронизацию напрямую');
      const result = await processSyncJob({ data: { marketplace, dateFrom, dateTo } });
      return res.json({ success: true, message: 'Синхронизация выполнена напрямую', result });
    }
    
    const job = await addSyncJob(marketplace, dateFrom, dateTo);
    res.json({ success: true, jobId: job.id });
    
  } catch (error) {
    console.error('❌ Ошибка запуска синхронизации:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;