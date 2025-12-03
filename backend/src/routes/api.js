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
    // Защита: если в окружении задан SYNC_SECRET — требуем заголовок `x-sync-secret`
    const syncSecret = process.env.SYNC_SECRET;
    if (syncSecret) {
      const provided = req.headers['x-sync-secret'] || req.headers['x-sync-token'];
      if (!provided || provided !== syncSecret) {
        return res.status(401).json({ error: 'Invalid or missing x-sync-secret header' });
      }
    }
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

    const job = await addSyncJob(marketplace, from, to);
    res.json({ success: true, jobId: job.id, dateFrom: from, dateTo: to });
  } catch (error) {
    console.error('❌ Error in /sync/trigger:', error && (error.stack || error));
    // TEMPORARY DEBUG: return full stack trace for diagnostics
    const errorDetails = {
      error: typeof error === 'string' ? error : (error && error.message) || 'Unknown error',
      stack: error && error.stack ? error.stack.split('\n') : [],
      type: error && error.constructor && error.constructor.name,
      full: JSON.stringify(error, null, 2)
    };
    console.error('❌ Full error details:', errorDetails);
    res.status(500).json({ error: 'Sync trigger failed', details: errorDetails });
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