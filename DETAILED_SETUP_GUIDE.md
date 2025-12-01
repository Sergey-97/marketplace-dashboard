# 📋 ПОШАГОВЫЕ ИНСТРУКЦИИ ДЛЯ НАСТРОЙКИ И ДЕПЛОЯ

Этот документ содержит детальные инструкции для каждого этапа настройки проекта.

---

## 📍 ЭТАП 1: ПОДГОТОВКА ЛОКАЛЬНОГО ОКРУЖЕНИЯ

### Шаг 1.1: Проверка Git и текущего статуса

```powershell
# Откройте PowerShell в папке проекта
cd 'C:\Users\user\marketplace-dashboard'

# Проверьте текущую ветку
git branch
# Должна быть: * main

# Проверьте статус
git log --oneline -3
# Должны видеть последний коммит "fix: Complete project overhaul..."
```

**Ожидаемый результат:**
```
* a8e93bb fix: Complete project overhaul with CORS, worker...
* 3752fdc (previous commit)
* ... (more commits)
```

### Шаг 1.2: Проверка структуры проекта

```powershell
# Проверьте что все файлы на месте
dir backend\src\
dir frontend\
dir .github\workflows\

# Должны видеть:
# - backend/src/index.js
# - backend/src/jobs/sync.worker.enhanced.js
# - frontend/index.html
# - .github/workflows/ci.yml
# - .env.example в backend/
```

### Шаг 1.3: Установка зависимостей (опционально, для локальной разработки)

```powershell
# Перейти в backend
cd backend

# Установить зависимости
npm install

# Проверить что всё установилось
npm list --depth=0

# Должны видеть основные зависимости:
# ├── express
# ├── cors
# ├── bullmq (или bull)
# ├── @supabase/supabase-js
# └── другие...

# Вернуться в корень проекта
cd ..
```

---

## 🔐 ЭТАП 2: ПОДГОТОВКА УЧЕТНЫХ ДАННЫХ И КЛЮЧЕЙ

### Шаг 2.1: Сбор необходимых ключей и URL

Прежде чем приступать к настройке на Render, соберите эти данные:

**Из Supabase:**
```
1. Перейти на https://supabase.com → Your Project
2. Settings → API
3. Скопировать:
   - Project URL → SUPABASE_URL
   - service_role key (с префиксом "SUPABASE_SERVICE_KEY") → SUPABASE_SERVICE_KEY

Пример:
SUPABASE_URL=https://xyzabc.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Из OZON:**
```
1. Личный кабинет OZON → Интеграции → API
2. Скопировать:
   - API Key → OZON_API_KEY
   - Client ID → OZON_CLIENT_ID (опционально)

Пример:
OZON_API_KEY=12345abcde...
```

**Из Wildberries:**
```
1. Личный кабинет WB → Интеграции → API
2. Скопировать:
   - API Key → WB_API_KEY

Пример:
WB_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Из Render (опционально, только если будете использовать Managed Redis):**
```
1. Если вы не создавали Redis на Render - пропустите этот пункт
2. Если создавали: скопировать полный REDIS_URL из Redis сервиса

Пример:
REDIS_URL=redis://:password@redis-service-name.render.com:6379
```

**Из Vercel (URL фронтенда):**
```
1. Перейти на https://vercel.com → Projects
2. Найти проект frontend (marketplace-dashboard или похожее имя)
3. Скопировать Production URL

Пример:
https://marketplace-dashboard-git-master-sergeys-projects.vercel.app
```

### Шаг 2.2: Создание локального файла .env (для локальной разработки)

```powershell
# Перейти в папку backend
cd backend

# Скопировать шаблон
Copy-Item .env.example .env

# Открыть файл в редакторе (заменить значения на ваши!)
notepad .env
```

**Содержимое .env (заполните своими значениями):**
```env
PORT=10000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xyzabc.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...

# Redis (опционально для разработки)
REDIS_URL=
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS & Frontend
CORS_ORIGINS=http://localhost:3000,https://marketplace-dashboard-git-master-sergeys-projects.vercel.app
FRONTEND_URL=https://marketplace-dashboard-git-master-sergeys-projects.vercel.app

# Marketplace APIs
OZON_API_KEY=12345abcde...
OZON_CLIENT_ID=
WB_API_KEY=eyJ0eXAiOi...
```

**⚠️ ВАЖНО:** Никогда не коммитьте этот файл! Он в .gitignore.

### Шаг 2.3: Проверка что .env не будет закоммичен

```powershell
# Убедитесь что .env в .gitignore
cd ..
cat .gitignore | findstr ".env"

# Должно вывести: .env
```

---

## 🚀 ЭТАП 3: НАСТРОЙКА RENDER BACKEND

### Шаг 3.1: Подготовка информации

Откройте блокнот и запишите следующее (или держите в памяти):

```
1. Render Dashboard URL: https://dashboard.render.com
2. GitHub репозиторий: https://github.com/Sergey-97/marketplace-dashboard
3. Ветка: main
4. Web Service ID: (будет виден в Render)
5. Backend URL: (будет сгенерирован как https://marketplace-backend-XXXX.onrender.com)
```

### Шаг 3.2: Обновление Environment Variables для Web Service

```
1. Перейти на https://dashboard.render.com
2. Найти сервис "marketplace-backend" (Web Service)
3. Нажать на него
4. Перейти в "Settings"
5. Прокрутить вниз до "Environment"
6. Нажать "Edit"

7. Обновить/добавить следующие переменные:
```

**Таблица для копирования/вставки:**

| Ключ | Значение | Примечание |
|------|----------|-----------|
| `PORT` | `10000` | Не менять |
| `NODE_ENV` | `production` | Важно для логирования |
| `SUPABASE_URL` | `https://xyzabc.supabase.co` | Из шага 2.1 |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOi...` | Из шага 2.1 |
| `CORS_ORIGINS` | `https://marketplace-dashboard-git-master-sergeys-projects.vercel.app` | Vercel URL из шага 2.1 |
| `FRONTEND_URL` | `https://marketplace-dashboard-git-master-sergeys-projects.vercel.app` | Совпадает с CORS_ORIGINS |
| `OZON_API_KEY` | `12345abcde...` | Ваш ключ OZON |
| `WB_API_KEY` | `eyJ0eXAiOi...` | Ваш ключ WB |
| `REDIS_URL` | (оставить пусто) | Опционально, для разработки |

**Пошагово в Render:**

```
1. Click on Web Service
2. Click "Settings" tab
3. Scroll to "Environment"
4. Click "Edit" button
5. Paste or type each variable:
   PORT=10000
   NODE_ENV=production
   SUPABASE_URL=https://xyzabc.supabase.co
   ... (и т.д.)

6. Click "Save"
7. Service автоматически перезагрузится
```

### Шаг 3.3: Проверка что backend перезагрузился

```powershell
# Подождите 30-60 секунд чтобы сервис перезагрузился

# Затем проверьте здоровье сервера:
curl -i "https://marketplace-backend-XXXX.onrender.com/health"

# Замените XXXX на ID вашего сервиса (видно в Render)
# Ожидаемый результат:
# HTTP/1.1 200 OK
# {"ok":true,"timestamp":"2024-12-01T...","uptime":...}
```

**Если видите 200 OK** ✅ — backend работает!
**Если видите 404 или ошибку подключения** ❌ — проверьте логи (см. ниже).

### Шаг 3.4: Проверка логов Render

```
1. В Render Dashboard перейти в Web Service
2. Нажать на закладку "Logs"
3. Должны видеть сообщения вроде:

   ✅ Supabase connected
   ✅ Server running on http://localhost:10000
   🚀 Инициализация Marketplace Backend
   ✅ CORS Origins: https://marketplace-dashboard-...
```

**Если видны ошибки:**

```
❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set
→ Проверьте что переменные добавлены правильно в Environment

⚠️ REDIS_URL not set
→ Это нормально для разработки, worker будет работать с памятью

❌ Port already in use
→ Это ошибка конфигурации, свяжитесь с поддержкой Render
```

---

## 📦 ЭТАП 4: СОЗДАНИЕ BACKGROUND WORKER НА RENDER

### Шаг 4.1: Создание нового Background Worker сервиса

```
1. Перейти на https://dashboard.render.com
2. Нажать "New +"
3. Выбрать "Background Worker"
4. Выбрать репозиторий: marketplace-dashboard
5. Нажать "Connect"

6. Заполнить форму:
   Name: marketplace-worker (или любое имя)
   Runtime: Node
   Build Command: npm ci
   Start Command: cd backend && npm run worker
   Branch: main
   Root Directory: backend/

7. Нажать "Create"
```

### Шаг 4.2: Добавление Environment Variables для Worker

```
1. После создания откроется страница сервиса
2. Нажать "Settings"
3. Scroll to "Environment"
4. Click "Add Environment Variable"

5. Добавить ВСЕ переменные что добавили для Web Service:
   - PORT (10000)
   - NODE_ENV (production)
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - CORS_ORIGINS
   - FRONTEND_URL
   - OZON_API_KEY
   - WB_API_KEY

6. Нажать "Save"
```

### Шаг 4.3: Проверка что Worker запустился

```powershell
# Подождите 60 секунд для запуска и сборки

# Затем проверьте логи Worker:
# В Render Dashboard → Background Workers → marketplace-worker → Logs

# Должны видеть:
# 🔄 Инициализация Background Worker...
# ✅ Worker started and ready to process jobs
# (или сообщение про Redis)
```

**Если видны ошибки:**

```
❌ SUPABASE_URL not set
→ Проверьте что все переменные скопированы

Module not found: bullmq
→ Запустите npm install в backend/ локально
→ Коммитьте node_modules (или используйте CI для сборки)
```

---

## 🌐 ЭТАП 5: ПРОВЕРКА VERCEL FRONTEND

### Шаг 5.1: Проверка что Vercel проект существует

```powershell
# Откройте браузер и перейдите на:
# https://vercel.com/projects

# Найдите проект marketplace-dashboard (или похожее имя)
# Скопируйте Production URL:
# Пример: https://marketplace-dashboard-git-master-sergeys-projects.vercel.app
```

### Шаг 5.2: Проверка что фронтенд загружается

```powershell
# Откройте браузер и перейдите на ваш Vercel URL
# https://marketplace-dashboard-git-master-sergeys-projects.vercel.app

# Должны видеть:
# 1. Заголовок "📊 Marketplace Dashboard"
# 2. Форма с датами и кнопки
# 3. Кнопки "Загрузить данные", "Синхронизировать"

# Если видите 404 или пустую страницу - проверьте:
# 1. Правильно ли указан root directory (frontend)
# 2. Нет ли ошибок деплоя в Vercel Logs
```

### Шаг 5.3: Проверка API_BASE в HTML

```powershell
# В браузере нажмите F12 (DevTools)
# В консоли выполните:

document.querySelector('meta[name="api-base"]')?.getAttribute('content')

# Должно вывести:
# "https://marketplace-backend-XXXX.onrender.com/api"
# (и Render URL, и /api в конце)
```

---

## 🔗 ЭТАП 6: ТЕСТИРОВАНИЕ CORS И ИНТЕГРАЦИИ

### Шаг 6.1: Проверка CORS через curl

```powershell
# Замените XXXX на ваш Render ID и YOUR-VERCEL-URL на Vercel URL

# Тест 1: Простой запрос к health
curl -i "https://marketplace-backend-XXXX.onrender.com/health"

# Ожидаемый результат:
# HTTP/1.1 200 OK
# {"ok":true,"timestamp":"...","uptime":...}

# Тест 2: CORS preflight
curl -i -X OPTIONS "https://marketplace-backend-XXXX.onrender.com/api/products" `
  -H "Origin: https://YOUR-VERCEL-URL" `
  -H "Access-Control-Request-Method: GET" `
  -H "Access-Control-Request-Headers: content-type"

# Ожидаемый результат должен содержать:
# HTTP/1.1 204 No Content
# access-control-allow-origin: https://YOUR-VERCEL-URL
# access-control-allow-methods: GET, POST, ...

# Тест 3: Реальный запрос к API
curl -i "https://marketplace-backend-XXXX.onrender.com/api/products"

# Ожидаемый результат:
# HTTP/1.1 200 OK
# {"items":[],"count":0}
# (или данные если они загружены в Supabase)
```

### Шаг 6.2: Проверка в браузере (DevTools)

```
1. Откройте Vercel URL: https://YOUR-FRONTEND.vercel.app
2. Нажмите F12 (DevTools)
3. Перейдите на закладку "Network"
4. Нажмите кнопку "Загрузить данные"

5. В Network должны видеть запросы:
   GET /api/orders?startDate=... → 200 OK (если CORS работает)
   GET /api/order-expenses?startDate=... → 200 OK

6. Если видите красные ошибки с CORS:
   → Проверьте CORS_ORIGINS на Render
   → Убедитесь что Vercel URL совпадает
   → Перезагрузите сервис на Render
```

---

## 💾 ЭТАП 7: НАСТРОЙКА SUPABASE ТАБЛИЦ

### Шаг 7.1: Проверка существующих таблиц

```
1. Перейти на https://supabase.com
2. Выбрать ваш проект
3. В левом меню нажать "SQL Editor"
4. Нажать "New Query"

5. Выполнить запрос для проверки что таблицы существуют:

SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

6. Должны видеть таблицы:
   - products
   - sales_fact
   - orders_extended (опционально)
   - sync_logs (нужно создать)
```

### Шаг 7.2: Создание таблицы sync_logs (если её нет)

```sql
-- Скопируйте этот SQL в Supabase SQL Editor и выполните

CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace VARCHAR(50) NOT NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50), -- 'success', 'error', 'pending'
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Создайте индекс для быстрого поиска
CREATE INDEX idx_sync_logs_marketplace ON sync_logs(marketplace);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at DESC);

-- Проверьте что таблица создана
SELECT * FROM sync_logs LIMIT 1;
```

### Шаг 7.3: Проверка структуры таблицы products

```sql
-- Выполните в SQL Editor:

-- Проверьте структуру products
\d+ products;

-- Или просто:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products';

-- Должны быть примерно такие колонки:
-- id (UUID, Primary Key)
-- article (VARCHAR, UNIQUE)
-- name (VARCHAR)
-- price (NUMERIC)
-- marketplace (VARCHAR)
-- stock_wb (INT)
-- stock_ozon (INT)
-- warehouse_from (VARCHAR)
-- warehouse_to (VARCHAR)
```

### Шаг 7.4: Добавление недостающих колонок (если нужно)

```sql
-- Если колонок не хватает, добавьте их:

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS marketplace VARCHAR(50);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS warehouse_from VARCHAR(255);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS warehouse_to VARCHAR(255);

-- Аналогично для sales_fact (если не существуют):

ALTER TABLE sales_fact 
ADD COLUMN IF NOT EXISTS ad_spend NUMERIC DEFAULT 0;

ALTER TABLE sales_fact 
ADD COLUMN IF NOT EXISTS logistics_cost NUMERIC DEFAULT 0;

ALTER TABLE sales_fact 
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 0;
```

---

## 🔄 ЭТАП 8: ТЕСТИРОВАНИЕ СИНХРОНИЗАЦИИ

### Шаг 8.1: Запуск синхронизации через API

```powershell
# Замените XXXX на ваш Render ID

# Запустить синхронизацию OZON за период
$body = @{
    marketplace = "ozon"
    startDate = "2024-11-01"
    endDate = "2024-11-30"
} | ConvertTo-Json

curl -X POST "https://marketplace-backend-XXXX.onrender.com/api/sync/trigger" `
  -H "Content-Type: application/json" `
  -d $body

# Ожидаемый результат:
# {"jobId":"sync-ozon-2024-11-01-2024-11-30","status":"queued"}
```

### Шаг 8.2: Проверка статуса задачи

```powershell
# Используйте jobId из предыдущего запроса

curl "https://marketplace-backend-XXXX.onrender.com/api/sync/status/sync-ozon-2024-11-01-2024-11-30"

# Ожидаемый результат:
# {"jobId":"...","state":"completed","progress":100,"data":{...}}
```

### Шаг 8.3: Проверка логов в Supabase

```sql
-- В Supabase SQL Editor:

SELECT * FROM sync_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Должны видеть записи о синхронизации:
-- marketplace | start_date | end_date | status | created_at
-- ozon        | 2024-11-01 | 2024-11-30 | success | ...
```

### Шаг 8.4: Проверка загруженных данных

```sql
-- Проверьте что данные загружены в products:

SELECT COUNT(*) as total_products FROM products;
SELECT DISTINCT marketplace FROM products;

-- Проверьте данные в sales_fact:

SELECT COUNT(*) as total_sales FROM sales_fact;
SELECT DISTINCT marketplace FROM sales_fact;
```

---

## 🎨 ЭТАП 9: ПРОВЕРКА ФРОНТЕНДА

### Шаг 9.1: Загрузка данных через фронтенд

```
1. Откройте браузер на Vercel URL
2. Установите даты:
   - Дата начала: 2024-11-01
   - Дата окончания: 2024-11-30

3. Выберите маркетплейс: OZON (или All)

4. Нажмите кнопку "📥 Загрузить данные"

5. Должны видеть:
   - Статус "⏳ Загрузка данных..."
   - Через несколько секунд статус "✅ Загружено: N заказов"
   - Метрики (Всего заказов, Выручка, Расходы, Прибыль)
   - Таблицы с данными заказов и расходов
```

### Шаг 9.2: Тестирование синхронизации через фронтенд

```
1. На той же странице нажмите кнопку "🔄 Синхронизировать"

2. Должны видеть:
   - Статус "⏳ Запуск синхронизации..."
   - Кнопки станут неактивными (disabled)
   - Через 3 секунды данные обновятся

3. Проверьте что новые данные загружены в таблицах
```

### Шаг 9.3: Проверка обработки ошибок

```
1. Откройте браузер DevTools (F12)
2. Перейдите на закладку Console
3. Нажмите "Загрузить данные"

4. Проверьте что:
   - Нет красных ошибок в консоли
   - Если есть ошибки - это скорее всего CORS или Supabase проблемы
   - Сообщение об ошибке должно быть понятным (не "Failed to fetch")
```

---

## 🔍 ЭТАП 10: ОТЛАДКА И РЕШЕНИЕ ПРОБЛЕМ

### Шаг 10.1: Если данные не загружаются

**Проверка 1: Backend живой?**
```powershell
curl "https://marketplace-backend-XXXX.onrender.com/health"
# Должно вывести HTTP 200
```

**Проверка 2: CORS настроен?**
```powershell
curl -i "https://marketplace-backend-XXXX.onrender.com/api/products" `
  -H "Origin: https://YOUR-VERCEL.vercel.app"
# Ищите: access-control-allow-origin
```

**Проверка 3: Supabase подключен?**
```
1. В Render логи смотрите: Settings → Logs
2. Ищите: "✅ Connected to Supabase"
3. Если видите "❌ SUPABASE_URL not set" - добавьте в Environment
```

**Проверка 4: Таблицы существуют?**
```sql
-- Supabase SQL Editor:
SELECT * FROM products LIMIT 1;
SELECT * FROM sales_fact LIMIT 1;
-- Если ошибка - таблиц нет, создайте их
```

### Шаг 10.2: Если Worker не запускается

**Проверка 1: Логи Worker**
```
1. Render Dashboard → Background Workers → marketplace-worker
2. Нажмите Logs
3. Ищите: "✅ Worker started"
4. Если есть ошибка - читайте сообщение об ошибке
```

**Проверка 2: Environment Variables**
```
1. Settings → Environment
2. Убедитесь что есть SUPABASE_URL и SUPABASE_SERVICE_KEY
3. Если нет - добавьте их
4. Нажмите Save
```

**Проверка 3: Redis**
```
1. Если REDIS_URL пусто - это нормально, worker будет в памяти
2. Если нужен Redis - используйте Render Managed Redis или Upstash
3. Добавьте REDIS_URL в Environment
```

### Шаг 10.3: Если CORS ошибка

**Проблема:** Видите ошибку в браузере вроде:
```
Access to fetch at 'https://backend.onrender.com/api/...' from origin 
'https://frontend.vercel.app' has been blocked by CORS
```

**Решение:**
```powershell
# Шаг 1: Проверьте URL Vercel
curl -i "https://marketplace-backend-XXXX.onrender.com/health" `
  -H "Origin: https://YOUR-VERCEL-URL.vercel.app"

# Если видите: access-control-allow-origin: https://YOUR-VERCEL-URL
# Значит CORS работает!

# Шаг 2: Если не видите - обновите CORS_ORIGINS в Render:
# Settings → Environment → найдите CORS_ORIGINS
# Убедитесь что там точно ваш Vercel URL
# Сохраните, подождите 30 секунд

# Шаг 3: Проверьте что это именно Vercel URL:
# На страницу Vercel → Project → зайдите на Domains
# Скопируйте Production Domain (без https://)
```

### Шаг 10.4: Полная диагностика (если всё сломалось)

```powershell
# Выполните эти команды по порядку:

# 1. Проверьте backend здоровье
curl "https://marketplace-backend-XXXX.onrender.com/health"
Write-Host "Backend health check completed"

# 2. Проверьте API доступность
curl "https://marketplace-backend-XXXX.onrender.com/api/products"
Write-Host "API products check completed"

# 3. Проверьте CORS
curl -i -X OPTIONS "https://marketplace-backend-XXXX.onrender.com/api/products" `
  -H "Origin: https://YOUR-VERCEL.vercel.app"
Write-Host "CORS check completed"

# 4. Посмотрите логи Render
Write-Host "Проверьте логи в Render Dashboard"

# 5. Перезагрузитесь на Vercel
Write-Host "Перезагрузите страницу фронтенда в браузере (Ctrl+F5)"
```

---

## 📊 ЭТАП 11: РЕАЛИЗАЦИЯ СИНХРОНИЗАЦИИ С API

**ЭТО КРИТИЧЕСКИЙ ШАГ! Без этого синхронизация не будет работать!**

### Шаг 11.1: Открыть файл sync.worker.enhanced.js

```powershell
# В VS Code или редакторе откройте:
# backend/src/jobs/sync.worker.enhanced.js

# Найдите строку (примерно на строке 80):
# if (marketplace === 'ozon' || marketplace === 'all') {
#   console.log('📥 Syncing OZON...');
#   // TODO: Получить данные из OZON API
#   console.log(`✅ OZON sync completed`);
```

### Шаг 11.2: Добавить реальную синхронизацию OZON

```javascript
// Замените этот блок (примерно строки 80-85):

if (marketplace === 'ozon' || marketplace === 'all') {
  try {
    console.log('📥 Syncing OZON...');
    await job.progress(20);

    // ДОБАВЬТЕ ЭТОТ КОД (пример):
    
    // 1. Получить заказы из OZON API
    // const ozonOrders = await fetch('https://api.ozon.ru/v4/orders/list', {
    //   method: 'POST',
    //   headers: {
    //     'Client-Id': process.env.OZON_CLIENT_ID,
    //     'Api-Key': process.env.OZON_API_KEY,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     dir: 'ASC',
    //     filter: {
    //       statuses: ['awaiting_packaging', 'awaiting_delivery', 'delivered']
    //     },
    //     limit: 100,
    //     offset: 0
    //   })
    // }).then(r => r.json());

    // 2. Вставить в Supabase
    // if (ozonOrders.orders && ozonOrders.orders.length > 0) {
    //   const orders = ozonOrders.orders.map(o => ({
    //     order_id: o.order_id,
    //     marketplace: 'ozon',
    //     quantity: o.quantity,
    //     price: o.price,
    //     status: o.status,
    //     order_date: new Date(o.created_at * 1000)
    //   }));
    //   
    //   await supabase.from('sales_fact').insert(orders);
    //   processedOrders = ozonOrders.orders.length;
    // }

    await job.progress(50);
    console.log(`✅ OZON sync completed (${processedOrders} orders)`);
    syncDetails.ozon = { status: 'completed', orders: processedOrders };
    await logSync('ozon', startDate, endDate, 'success', { orders: processedOrders });
  } catch (err) {
    console.error('❌ OZON sync error:', err.message);
    syncDetails.ozon = { status: 'error', error: err.message };
    await logSync('ozon', startDate, endDate, 'error', { error: err.message });
  }
}
```

### Шаг 11.3: Тестирование синхронизации локально

```powershell
# Перейти в backend
cd backend

# Запустить worker локально
npm run worker:dev

# В другом терминале запустить сервер
npm run dev

# В третьем терминале запустить синхронизацию
curl -X POST "http://localhost:10000/api/sync/trigger" `
  -H "Content-Type: application/json" `
  -d '{"marketplace":"ozon","startDate":"2024-11-01","endDate":"2024-11-30"}'

# Смотрите логи - должна видеть обработку
```

### Шаг 11.4: Коммит изменений

```powershell
# Когда синхронизация работает локально - коммитьте

git add backend/src/jobs/sync.worker.enhanced.js

git commit -m "feat: Implement real OZON API synchronization

- Added real OZON API order fetching
- Map OZON data to Supabase sales_fact table
- Add error handling and logging
- Test with local OZON data"

git push origin main
```

---

## ✅ ФИНАЛЬНАЯ ЧЕКЛИСТ

Убедитесь что сделали всё:

```
[ ] Шаг 1.1-1.3: Проверена структура проекта
[ ] Шаг 2.1-2.3: Собраны все ключи API
[ ] Шаг 3.1-3.4: Настроены Environment переменные на Render
[ ] Шаг 4.1-4.3: Создан Background Worker
[ ] Шаг 5.1-5.3: Проверен Vercel frontend
[ ] Шаг 6.1-6.2: Протестирована CORS интеграция
[ ] Шаг 7.1-7.4: Настроены таблицы Supabase
[ ] Шаг 8.1-8.4: Протестирована синхронизация
[ ] Шаг 9.1-9.3: Фронтенд загружает данные
[ ] Шаг 10.1-10.4: Решены все проблемы
[ ] Шаг 11.1-11.4: Реализована реальная синхронизация
```

**Если все чекбоксы отмечены - ваш проект полностью готов к использованию! 🎉**

---

## 🆘 ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ

1. **Проверьте логи:**
   - Render: Dashboard → Services → Logs
   - Vercel: Deployments → Logs
   - Браузер: DevTools → Console

2. **Перезагрузитесь:**
   - На Render: Manual Deploy (нажать стрелку)
   - На Vercel: Trigger Redeploy
   - В браузере: Ctrl+F5 (Hard Refresh)

3. **Скопируйте ошибку и Google:**
   - Скопируйте полный текст ошибки
   - Вставьте в Google
   - Обычно решение уже на Stack Overflow

4. **Проверьте что коммит залил:**
   ```powershell
   git log --oneline -3
   # Должен видеть ваш последний коммит
   ```

---

## 📞 ПОЛЕЗНЫЕ ССЫЛКИ

- Render: https://dashboard.render.com
- Vercel: https://vercel.com
- Supabase: https://supabase.com
- GitHub: https://github.com/Sergey-97/marketplace-dashboard
- OZON API Docs: https://docs.ozon.ru
- WB API Docs: https://suppliers-api.wildberries.ru

---

**Удачи с настройкой! Если остаются вопросы - Google является вашим другом! 🚀**
