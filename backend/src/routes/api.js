// backend/src/routes/api.js
const express = require('express');
const router = express.Router();
const DataController = require('../controllers/data.controller');
const { addSyncJob, runFullSync } = require('../jobs/sync.cron');
const { loadAllHistory } = require('../utils/initial-loader');

// Данные для дашборда
router.get('/sales', DataController.getSales);
router.get('/products', DataController.getProducts);
router.get('/forecast', DataController.getForecast);
router.get('/kpi', DataController.getKPI);
router.get('/market-data', DataController.getMarketData);

// Управление синхронизацией
router.post('/sync/trigger', async (req, res) => {
  try {
    const { marketplace, dateFrom, dateTo } = req.body;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom и dateTo обязательны' });
    }
    
    const job = await addSyncJob(marketplace, dateFrom, dateTo);
    res.json({ success: true, jobId: job.id });
    
  } catch (error) {
    console.error('❌ Ошибка запуска синхронизации:', error);
    res.status(500).json({ error: error.message });
  }
});

// Первая полная синхронизация
router.post('/sync/full', async (req, res) => {
  try {
    const result = await runFullSync();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Загрузка всей истории (по частям)
router.post('/sync/history', async (req, res) => {
  try {
    loadAllHistory(); // Асинхронно, не ждем завершения
    res.json({ success: true, message: 'Историческая загрузка запущена' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;