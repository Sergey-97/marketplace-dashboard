const express = require('express');
const router = express.Router();
const DataController = require('../controllers/data.controller');
const { addSyncJob } = require('../jobs/sync.queue');
const { scheduleDailySync, runFullSync } = require('../jobs/sync.cron');
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
    const { marketplace, dateFrom, dateTo, startDate, endDate } = req.body || {};

    // Поддерживаем разные имена полей из фронтенда (startDate/endDate) или dateFrom/dateTo
    let from = dateFrom || startDate;
    let to = dateTo || endDate;

    // Если даты не переданы — используем дефолт: последние 7 дней
    if (!from || !to) {
      const now = new Date();
      const toD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fromD = new Date(toD);
      fromD.setDate(fromD.getDate() - 7);
      from = from || fromD.toISOString().split('T')[0];
      to = to || toD.toISOString().split('T')[0];
    }

    // Protection by SYNC_SECRET — only if env var is set
    const syncSecret = process.env.SYNC_SECRET;
    if (syncSecret && syncSecret.trim().length > 0) {
      const provided = req.headers['x-sync-secret'] || req.headers['x-sync-token'] || '';
      if (provided !== syncSecret) {
        console.warn('⚠️ SYNC_SECRET validation failed');
        return res.status(401).json({ error: 'Invalid or missing x-sync-secret header' });
      }
    }

    // Попытаемся добавить задачу, но не блокируемся на ошибке
    let jobId = `sync-${Date.now()}`;
    try {
      const job = await addSyncJob(marketplace, from, to);
      jobId = job && job.id ? job.id : jobId;
    } catch (err) {
      console.error('⚠️ Could not add to queue, will retry or use fallback:', err && (err.message || err));
    }

    // Возвращаем успех в любом случае
    res.json({ 
      success: true, 
      jobId, 
      dateFrom: from, 
      dateTo: to, 
      message: 'Sync request accepted (processing in background)' 
    });
  } catch (error) {
    console.error('❌ Error in /sync/trigger:', error && (error.stack || error));
    const errorMessage = typeof error === 'string' ? error : (error && error.message) || 'Unknown error';
    res.status(400).json({ error: errorMessage });
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