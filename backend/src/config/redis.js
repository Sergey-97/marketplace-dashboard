// backend/src/config/redis.js
const Redis = require('ioredis');
require('dotenv').config();

let redisClient = null;

if (process.env.REDIS_HOST) {
  // Пробуем подключиться с использованием пароля, если он указан
  redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined, // Добавлено использование пароля
    // BullMQ requires maxRetriesPerRequest === null
    maxRetriesPerRequest: null,
    // Не используем lazyConnect, подключаемся сразу чтобы BullMQ получил готовый клиент
    lazyConnect: false,
    // Настройка повторного подключения
    retryStrategy: (times) => Math.min(times * 50, 2000),
    reconnectOnError: (err) => {
      // по умолчанию пробуем переподключиться при сетевых ошибках
      return true;
    }
  });
  
  redisClient.on('connect', () => {
    console.log('✅ Подключено к Redis (с использованием пароля, если указан)');
  });
  
  redisClient.on('error', (err) => {
    console.warn('⚠️ Redis error:', err.message);
    redisClient = null;
  });
} else {
  console.log('⚠️ Redis не настроен - режим памяти');
}

module.exports = redisClient;