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

// ============================================
// СУТЬ ПРОЕКТА: API для сбора данных маркетплейсов (OZON, Wildberries)
// ============================================
console.log('🚀 Инициализация Marketplace Backend');

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// === Улучшенная CORS конфигурация ===
// Поддерживаем значения как с протоколом (https://...), так и без него (example.com)
const rawOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Нормализуем: для каждого значения добавляем вариант с https:// если протокол не указан
const normalize = o => {
  if (!o) return null;
  if (o.startsWith('http://') || o.startsWith('https://')) return o;
  return `https://${o}`;
};

const allowedOrigins = new Set();
rawOrigins.forEach(o => {
  const n = normalize(o);
  allowedOrigins.add(o);
  if (n) allowedOrigins.add(n);
});

console.log('✅ CORS Origins (raw):', rawOrigins.length ? rawOrigins : 'all (development)');
console.log('✅ CORS Origins (normalized):', Array.from(allowedOrigins).length ? Array.from(allowedOrigins) : 'all (development)');

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return callback(null, true);

    // If no origins configured — allow all (development fallback)
    if (allowedOrigins.size === 0) return callback(null, true);

    // If the incoming origin matches any allowed variant — allow
    if (allowedOrigins.has(origin)) return callback(null, true);

    // Also allow if stripped origin (without protocol) matches configured raw entry
    const stripped = origin.replace(/^https?:\/\//i, '');
    if (rawOrigins.includes(stripped)) return callback(null, true);

    console.warn('⚠️ CORS blocked:', origin);
    callback(new Error('CORS: Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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