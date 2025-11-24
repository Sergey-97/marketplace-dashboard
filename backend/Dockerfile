# backend/Dockerfile

# Используем официальный Node.js образ версии 18 (Alpine - легковесная версия)
FROM node:18-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
# Это делается отдельно для кэширования зависимостей
COPY package*.json ./

# Устанавливаем зависимости (только production)
# npm ci - чистая установка, быстрее и надежнее
RUN npm ci --only=production

# Копируем весь исходный код
# .dockerignore исключит node_modules и .env
COPY . .

# Создаем не-root пользователя для безопасности
# Контейнеры не должны работать от root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Меняем владельца файлов на нового пользователя
RUN chown -R nodeuser:nodejs /app

# Переключаемся на не-root пользователя
USER nodeuser

# Открываем порт 10000 (Render требует это)
EXPOSE 10000

# Health check - проверка, что сервер жив
# Каждые 30 секунд делает HTTP запрос к /health
# Если 3 раза не ответит - контейнер перезапустится
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Команда запуска приложения
# Запускает node src/index.js
CMD ["node", "src/index.js"]