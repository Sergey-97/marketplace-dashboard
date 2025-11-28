const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const supabase = require('./config/supabase');
const apiRoutes = require('./routes/api');
const { scheduleDailySync } = require('./jobs/sync.cron');
const { syncWorker } = require('./jobs/sync.worker');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'https://marketplace-dashboard-frontend.vercel.app'], // Добавлен Vercel-URL
  credentials: true
}));

app.get('/', (req, res) => {
  res.json({
    service: 'Marketplace Dashboard API',
    version: '1.0.0',
    health: '/health',
    status: 'online'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    supabase: !!process.env.SUPABASE_URL,
    redis: !!process.env.REDIS_URL,
    worker: !!syncWorker
  });
});

app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Необработанная ошибка:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

async function startServer() {
  try {
    await supabase.from('products').select('count').limit(1);
    console.log('✅ Supabase подключен');
    
    scheduleDailySync();
    
    if (syncWorker) {
      console.log('✅ Worker запущен');
    } else {
      console.log('⚠️ Worker в режиме памяти');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер на порту ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM');
  process.exit(0);
});