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

    // Allow Vercel preview domains (different preview URLs per branch)
    try {
      const lower = origin.toLowerCase();
      if (/\.vercel\.app(:\d+)?$/.test(lower)) {
        return callback(null, true);
      }
      // Allow localhost origins for local testing
      if (/localhost(:\d+)?$/.test(lower)) {
        return callback(null, true);
      }
    } catch (e) {
      // ignore
    }

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

// Middleware: explicitly echo allowed Origin to ensure Access-Control-Allow-Origin
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin;
    if (!origin) return next();

    // reuse same checks as corsOptions
    const lower = origin.toLowerCase();
    if (allowedOrigins.size === 0 || allowedOrigins.has(origin) || rawOrigins.includes(origin) || rawOrigins.includes(origin.replace(/^https?:\/\//i, '')) ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      return next();
    }

    if (/\.vercel\.app(:\d+)?$/.test(lower) || /localhost(:\d+)?$/.test(lower)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      return next();
    }
  } catch (e) {
    // ignore
  }
  return next();
});

// FINAL middleware: ensure Access-Control-Allow-Origin echoes request origin
// This will overwrite any previous value and is safe for development/previews.
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Vary', 'Origin');
  } catch (e) {
    // ignore
  }
  next();
});

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

// Debug: логируем зарегистрированные маршруты для быстрой проверки в логах Render
try {
  const listRoutes = () => {
    const routes = [];
    app._router.stack.forEach(mw => {
      if (mw.route && mw.route.path) {
        routes.push(mw.route.path);
      } else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
        mw.handle.stack.forEach(r => {
          if (r.route && r.route.path) routes.push('/api' + r.route.path);
        });
      }
    });
    console.log('📦 Registered routes:', routes);
  };
  listRoutes();
} catch (e) {
  console.warn('⚠️ Не удалось вывести список маршрутов:', e.message);
}

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Необработанная ошибка:', err && (err.stack || err));
  // If caller provided correct sync secret, include stack for faster debugging (temporary)
  const provided = (req && (req.headers['x-sync-secret'] || req.headers['x-sync-token'])) || '';
  const allowed = process.env.SYNC_SECRET && process.env.SYNC_SECRET.trim().length > 0;
  const includeStack = allowed && provided && provided === process.env.SYNC_SECRET;

  const body = {
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? (err && err.message) : 'Something went wrong'
  };
  if (includeStack) body.stack = err && (err.stack || String(err));

  res.status(500).json(body);
});

// Global process-level handlers to capture unhandled errors and log them
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason && (reason.stack || reason));
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err && (err.stack || err));
  // do not exit in production immediately; let process manager handle restarts
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