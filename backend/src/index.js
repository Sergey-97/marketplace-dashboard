// backend/src/index.js
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

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    supabase: !!process.env.SUPABASE_URL,
    redis: !!process.env.REDIS_HOST,
    ozon: !!process.env.OZON_CLIENT_ID,
    wb: !!process.env.WB_API_KEY
  });
});

// Основные маршруты
app.use('/api', apiRoutes);

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('❌ Необработанная ошибка:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Запуск сервера
async function startServer() {
  try {
    // Проверяем подключение к Supabase
    const { data, error } = await supabase.from('products').select('count').limit(1);
    if (error) {
      console.error('❌ Ошибка подключения к Supabase:', error.message);
      process.exit(1);
    }
    console.log('✅ Подключено к Supabase');

    // Запускаем cron
    scheduleDailySync();
    
    // Запускаем worker (если Redis есть)
    if (syncWorker) {
      console.log('✅ Worker синхронизации запущен');
    } else {
      console.log('⚠️  Worker не запущен (отсутствует Redis)');
    }

    // Прослушиваем порт
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Критическая ошибка при запуске:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM получен, завершение работы...');
  process.exit(0);
});