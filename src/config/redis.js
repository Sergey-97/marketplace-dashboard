// backend/src/config/redis.js
const Redis = require('ioredis');
require('dotenv').config();

let redisClient;

if (process.env.REDIS_HOST && process.env.REDIS_PASSWORD) {
  redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  redisClient.on('error', (err) => {
    console.warn('⚠️  Redis error (без Redis будет работать в обход очереди):', err.message);
  });

  redisClient.on('connect', () => {
    console.log('✅ Подключено к Redis');
  });
} else {
  console.log('⚠️  REDIS_HOST не настроен - очередь будет работать в памяти');
  redisClient = null;
}

module.exports = redisClient;