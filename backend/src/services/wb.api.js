// backend/src/services/wb.api.js
const axios = require('axios');
require('dotenv').config();

class WBAPIService {
  constructor() {
    this.apiKey = process.env.WB_API_KEY;
    this.statisticsURL = 'https://statistics-api.wildberries.ru/api/v1';
    this.marketplaceURL = 'https://marketplace-api.wildberries.ru/api/v2';
    this.supplyURL = 'https://supplies-api.wildberries.ru/api/v1';
    
    if (!this.apiKey) {
      console.warn('⚠️  WB API Key отсутствует');
    }
  }

  /**
   * Получить продажи за период
   * @param {string} dateFrom - '2024-01-01'
   * @param {string} dateTo - '2024-01-31'
   * @returns {Promise<Array>} массив продаж
   */
  async getSales(dateFrom, dateTo) {
    if (!this.apiKey) {
      console.warn('WB API Key не настроен, возвращаем пустой массив');
      return [];
    }

    let allSales = [];
    let page = 1;
    const limit = 100000; // WB возвращает максимум
    let hasMore = true;

    // Преобразуем даты в ISO format
    const startDateISO = `${dateFrom}T00:00:00`;
    const endDateISO = `${dateTo}T23:59:59`;

    while (hasMore) {
      try {
        console.log(`📦 Загрузка продаж WB, страница ${page}...`);
        
        // WB API требует параметр dateFrom и только его
        // Для пагинации используем next=номер_последней_записи
        const response = await axios.get(
          `${this.statisticsURL}/supplier/sales`,
          {
            params: {
              dateFrom: startDateISO,
              flag: 1, // Включить отмененные и возвраты
              limit: limit,
              offset: (page - 1) * limit
            },
            headers: {
              'Authorization': this.apiKey,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (compatible; MarketplaceSync/1.0)'
            },
            timeout: 90000 // WB может долго отвечать
          }
        );

        const sales = response.data || [];
        
        if (sales.length === 0) {
          hasMore = false;
        } else {
          allSales.push(...sales.filter(s => {
            // Фильтруем по фактической дате, так как WB возвращает с dateFrom
            const saleDate = new Date(s.date);
            return saleDate >= new Date(startDateISO) && saleDate <= new Date(endDateISO);
          }));
          page++;
          
          // WB rate limit: 150 запросов/мин, но обычно нужно меньше
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Ошибка при загрузке продаж WB, страница ${page}:`, error.message);
        
        if (error.response?.status === 429) {
          console.log('⏳ Rate limit достигнут, ждем 60 сек...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        } else if (error.response?.status === 401) {
          console.error('❌ Неверный API Key WB');
          hasMore = false;
        }
        
        hasMore = false;
      }
    }

    console.log(`✅ Загружено ${allSales.length} продаж WB`);
    return allSales;
  }

  /**
   * Получить остатки
   * @returns {Promise<Array>} массив остатков
   */
  async getStocks() {
    if (!this.apiKey) {
      console.warn('WB API Key не настроен');
      return [];
    }

    try {
      console.log('📦 Загрузка остатков WB...');
      
      const response = await axios.get(
        `${this.supplyURL}/supply/stocks`,
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const stocks = response.data || [];
      console.log(`✅ Получено ${stocks.length} записей остатков WB`);
      return stocks;

    } catch (error) {
      console.error('❌ Ошибка при загрузке остатков WB:', error.message);
      return [];
    }
  }

  /**
   * Форматировать продажу для вставки в БД
   */
  formatSale(sale) {
    try {
      // WB возвращает каждую позицию отдельно, quantity обычно = 1
      return {
        marketplace: 'wildberries',
        order_id: sale.srid || `${sale.nmId}_${sale.date}`,
        article: sale.nmId?.toString(),
        sku: sale.chrtId?.toString(),
        quantity: sale.quantity || 1,
        price: sale.totalPrice || 0,
        total_amount: sale.totalPrice || 0,
        order_date: sale.date,
        channel: sale.officeName?.includes('FBO') ? 'FBO' : 'FBS',
        commission: sale.saleID ? (sale.totalPrice * 0.15) : 0, // Пример
        product_name: sale.supplierArticle || '',
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Ошибка форматирования продажи WB:', error.message);
      return null;
    }
  }
}

module.exports = new WBAPIService();