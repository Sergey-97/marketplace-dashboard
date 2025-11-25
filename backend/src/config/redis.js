// backend/src/config/redis.js
const Redis = require('ioredis');
require('dotenv').config();

let redisClient = null;

if (process.env.REDIS_HOST) {
  // Пробуем подключиться без пароля
  redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    reconnectOnError: () => true
  });
  
  redisClient.on('connect', () => {
    console.log('✅ Подключено к Redis (без пароля)');
  });
  
  redisClient.on('error', (err) => {
    console.warn('⚠️ Redis error:', err.message);
    redisClient = null;
  });
} else {
  console.log('⚠️ Redis не настроен - режим памяти');
}

module.exports = redisClient;