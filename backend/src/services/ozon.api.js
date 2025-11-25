// backend/src/services/ozon.api.js
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class OzonAPIService {
  constructor() {
    this.clientId = process.env.OZON_CLIENT_ID;
    this.apiKey = process.env.OZON_API_KEY;
    this.baseURL = 'https://api-seller.ozon.ru/v2';
    
    if (!this.clientId || !this.apiKey) {
      console.warn('⚠️  OZON credentials отсутствуют');
    }
  }

  /**
   * Получить все заказы за период с пагинацией
   * @param {string} dateFrom - '2024-01-01'
   * @param {string} dateTo - '2024-01-31'
   * @returns {Promise<Array>} массив заказов
   */
  async getOrders(dateFrom, dateTo) {
    if (!this.clientId || !this.apiKey) {
      console.warn('OZON API credentials не настроены, возвращаем пустой массив');
      return [];
    }

    const allOrders = [];
    let page = 1;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        console.log(`📦 Загрузка заказов OZON, страница ${page}...`);
        
        const response = await axios.post(
          `${this.baseURL}/posting/fbo/list`,
          {
            dir: 'asc',
            filter: {
              since: `${dateFrom}T00:00:00.000Z`,
              to: `${dateTo}T23:59:59.999Z`
            },
            limit: limit,
            offset: (page - 1) * limit,
            with: { 
              analytics_data: true, 
              financial_data: true,
              product_exemplars: true
            }
          },
          {
            headers: {
              'Client-Id': this.clientId,
              'Api-Key': this.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );

        const orders = response.data?.result || [];
        
        if (orders.length === 0) {
          hasMore = false;
        } else {
          allOrders.push(...orders);
          page++;
          
          // Пауза для соблюдения rate limit (30 запросов/мин)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Ошибка при загрузке заказов OZON, страница ${page}:`, error.message);
        
        if (error.response?.status === 429) {
          console.log('⏳ Rate limit достигнут, ждем 30 сек...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }
        
        hasMore = false;
      }
    }

    console.log(`✅ Загружено ${allOrders.length} заказов OZON`);
    return allOrders;
  }

  /**
   * Получить список товаров
   * @returns {Promise<Array>} массив товаров
   */
  async getProducts() {
    if (!this.clientId || !this.apiKey) {
      console.warn('OZON API credentials не настроены');
      return [];
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/product/list`,
        { limit: 1000, offset: 0 },
        {
          headers: {
            'Client-Id': this.clientId,
            'Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const items = response.data?.result?.items || [];
      console.log(`✅ Получено ${items.length} товаров OZON`);
      return items;

    } catch (error) {
      console.error('❌ Ошибка при получении товаров OZON:', error.message);
      return [];
    }
  }

  /**
   * Форматировать заказ для вставки в БД
   */
  formatOrder(order) {
    try {
      const items = order.products || [];
      const financialData = order.financial_data || {};
      const analyticData = order.analytics_data || {};

      return items.map(item => ({
        marketplace: 'ozon',
        order_id: `${order.order_id}_${item.sku}`, // Составной ключ
        article: item.offer_id,
        sku: item.sku?.toString(),
        quantity: item.quantity || 1,
        price: item.price || 0,
        total_amount: (item.quantity || 1) * (item.price || 0),
        order_date: order.in_process_at || order.created_at,
        channel: order.posting_method === 'fbo' ? 'FBO' : 'FBS',
        commission: financialData.commission_amount || 0,
        product_name: item.name || '',
        created_at: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ Ошибка форматирования заказа OZON:', error.message);
      return [];
    }
  }
}

module.exports = new OzonAPIService();