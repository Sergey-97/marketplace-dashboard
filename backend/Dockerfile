FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Исправление: используем npm install вместо ci для надежности
RUN npm install --omit=dev --no-fund --no-audit

COPY src/ ./src/

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 && \
    chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/index.js"]