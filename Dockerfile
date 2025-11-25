FROM node:20-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package files
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY src/ ./src/

# Создание не-root пользователя
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Изменение владельца
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Открытие порта
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Запуск
CMD ["node", "src/index.js"]