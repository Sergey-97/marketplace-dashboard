const express = require('express');
const router = express.Router();
const DataController = require('../controllers/data.controller');
const { addSyncJob, runFullSync } = require('../jobs/sync.cron');
const { loadAllHistory } = require('../utils/initial-loader');

// Исправлено: async/await и обработка ошибок
router.get('/sales', async (req, res) => {
  try {
    await DataController.getSales(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    await DataController.getProducts(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/forecast', async (req, res) => {
  try {
    await DataController.getForecast(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/kpi', async (req, res) => {
  try {
    await DataController.getKPI(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/market-data', async (req, res) => {
  try {
    await DataController.getMarketData(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    await DataController.getOrders(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/order-expenses', async (req, res) => {
  try {
    await DataController.getOrderExpenses(req, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync/trigger', async (req, res) => {
  try {
    const { marketplace, dateFrom, dateTo } = req.body;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom и dateTo обязательны' });
    }
    const job = await addSyncJob(marketplace, dateFrom, dateTo);
    res.json({ success: true, jobId: job.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync/full', async (req, res) => {
  try {
    const result = await runFullSync();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync/history', async (req, res) => {
  try {
    loadAllHistory();
    res.json({ success: true, message: 'Историческая загрузка запущена' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;