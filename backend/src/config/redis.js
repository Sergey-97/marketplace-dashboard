// backend/src/config/redis.js
const Redis = require('ioredis');
require('dotenv').config();

let redisClient = null;

try {
  if (process.env.REDIS_URL) {
    // Поддерживаем единый URL подключения
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  } else if (process.env.REDIS_HOST) {
    // Пробуем подключиться с использованием пароля, если он указан
    redisClient = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  } else {
    console.log('⚠️ Redis не настроен - режим памяти');
  }

  if (redisClient) {
    redisClient.on('connect', () => {
      console.log('✅ Подключено к Redis (с использованием пароля, если указан)');
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis error:', err.message);
      // Не сбрасываем клиент, пусть приложение решает о fallback
    });
  }
} catch (e) {
  console.warn('⚠️ Не удалось инициализировать Redis client:', e.message);
  redisClient = null;
}

module.exports = redisClient;