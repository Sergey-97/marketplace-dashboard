// backend/src/controllers/data.controller.js
const supabase = require('../config/supabase');

class DataController {
  /**
   * Получить продажи за период
   * GET /api/sales?startDate=2024-01-01&endDate=2024-01-31&marketplace=all&groupBy=day
   */
  async getSales(req, res) {
    try {
      const { 
        startDate, 
        endDate, 
        marketplace = 'all', 
        groupBy = 'day',
        article = null
      } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate и endDate обязательны' });
      }

      // Базовый запрос
      let query = supabase
        .from('sales_fact')
        .select('*')
        .gte('order_date', `${startDate}T00:00:00`)
        .lte('order_date', `${endDate}T23:59:59`);

      // Фильтр по маркетплейсу
      if (marketplace !== 'all') {
        query = query.eq('marketplace', marketplace);
      }

      // Фильтр по артикулу
      if (article) {
        query = query.eq('article', article);
      }

      // Сортировка
      query = query.order('order_date', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Ошибка получения продаж:', error);
        return res.status(500).json({ error: error.message });
      }

      // Агрегация данных
      const aggregated = this.aggregateSales(data, groupBy);

      res.json({
        success: true,
        data: aggregated,
        count: data.length
      });

    } catch (error) {
      console.error('❌ Необработанная ошибка:', error);
      res.status(500).json({ error: error.message, details: error }); // Добавлен details
    }
  }

  /**
   * Агрегировать продажи по времени
   */
  aggregateSales(rawData, groupBy) {
    const aggregated = {};

    rawData.forEach(item => {
      const date = new Date(item.order_date);
      let key;

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString();
      }

      if (!aggregated[key]) {
        aggregated[key] = {
          date: key,
          revenue: 0,
          quantity: 0,
          orders: 0,
          avg_price: 0,
          marketplace: item.marketplace,
          data: []
        };
      }

      aggregated[key].revenue += item.total_amount || 0;
      aggregated[key].quantity += item.quantity || 0;
      aggregated[key].orders += 1;
      aggregated[key].data.push(item);
    });

    // Расчет средней цены
    Object.values(aggregated).forEach(group => {
      group.avg_price = group.quantity > 0 ? group.revenue / group.quantity : 0;
    });

    return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Получить товары
   * GET /api/products?category=Сковороды
   */
  async getProducts(req, res) {
    try {
      const { category, inStock = 'false' } = req.query;

      let query = supabase.from('products').select('*');

      if (category) {
        query = query.eq('category', category);
      }

      if (inStock === 'true') {
        query = query.or('stock_wb.gt.0,stock_ozon.gt.0');
      }

      query = query.order('updated_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Ошибка получения товаров:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({
        success: true,
        data,
        count: data.length
      });

    } catch (error) {
      res.status(500).json({ error: error.message, details: error }); // Добавлен details
    }
  }

  /**
   * Получить KPI для дашборда
   * GET /api/kpi?startDate=2024-01-01&endDate=2024-01-31
   */
  async getKPI(req, res) {
    try {
      const { startDate, endDate, marketplace = 'all' } = req.query;

      const { data, error } = await supabase.rpc('calculate_kpi', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_marketplace: marketplace
      });

      if (error) {
        console.error('❌ Ошибка расчета KPI:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({
        success: true,
        kpi: data[0] || {}
      });

    } catch (error) {
      res.status(500).json({ error: error.message, details: error }); // Добавлен details
    }
  }

  /**
   * Получить прогноз
   * GET /api/forecast?article=VGA-26&months=3
   */
  async getForecast(req, res) {
    try {
      const { article, months = 3 } = req.query;

      if (!article) {
        return res.status(400).json({ error: 'article обязателен' });
      }

      // Здесь будет ваша логика прогнозирования
      // Пока возвращаем mock данные
      const forecast = await this.generateForecast(article, parseInt(months));

      res.json({
        success: true,
        forecast
      });

    } catch (error) {
      res.status(500).json({ error: error.message, details: error }); // Добавлен details
    }
  }

  /**
   * Генерация прогноза (заглушка - замените на реальный алгоритм)
   */
  async generateForecast(article, months) {
    // Получаем исторические данные
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const { data: history } = await supabase
      .from('sales_fact')
      .select('order_date, total_amount, quantity')
      .eq('article', article)
      .gte('order_date', startDate.toISOString())
      .order('order_date', { ascending: true });

    if (!history || history.length === 0) {
      return { error: 'Недостаточно данных для прогноза' };
    }

    // Простая линейная экстраполяция (замените на Prophet или другую модель)
    const avgDailySales = history.reduce((sum, item) => sum + (item.quantity || 0), 0) / history.length;
    const avgPrice = history.reduce((sum, item) => sum + (item.total_amount || 0), 0) / history.length;

    const forecast = [];
    const startForecastDate = new Date();

    for (let i = 1; i <= months * 30; i++) {
      const forecastDate = new Date(startForecastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      // Добавляем сезонность (пример: +20% в выходные)
      const dayOfWeek = forecastDate.getDay();
      const seasonality = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;

      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        predicted_quantity: Math.round(avgDailySales * seasonality),
        predicted_revenue: Math.round(avgDailySales * seasonality * avgPrice),
        confidence_lower: Math.round(avgDailySales * 0.8),
        confidence_upper: Math.round(avgDailySales * 1.2)
      });
    }

    return forecast;
  }

  /**
   * Получить рыночные данные (пока возвращаем агрегаты)
   */
  async getMarketData(req, res) {
    try {
      const { category, startDate, endDate } = req.query;

      // Агрегируем данные по категории из наших продаж
      const { data, error } = await supabase
        .from('sales_fact')
        .select('order_date, total_amount, quantity')
        .eq('category', category)
        .gte('order_date', startDate)
        .lte('order_date', endDate);

      if (error) throw error;

      res.json({
        success: true,
        data: this.aggregateSales(data, 'week')
      });

    } catch (error) {
      res.status(500).json({ error: error.message, details: error }); // Добавлен details
    }
  }

  /**
   * Получить расширенные данные по заказам
   * GET /api/orders?startDate=2024-01-01&endDate=2024-01-31&marketplace=all
   */
  async getOrders(req, res) {
    try {
      const { startDate, endDate, marketplace = 'all', article = null } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate и endDate обязательны' });
      }
      let query = supabase
        .from('sales_fact')
        .select('order_id, article, sku, product_name, marketplace, quantity, price, total_amount, order_date, channel, commission, paid_by_customer, co_investment_price, warehouse_from, warehouse_to, stock_wb, stock_ozon, status')
        .gte('order_date', `${startDate}T00:00:00`)
        .lte('order_date', `${endDate}T23:59:59`);
      if (marketplace !== 'all') {
        query = query.eq('marketplace', marketplace);
      }
      if (article) {
        query = query.eq('article', article);
      }
      query = query.order('order_date', { ascending: true });
      const { data, error } = await query;
      if (error) {
        console.error('❌ Ошибка получения заказов:', error);
        return res.status(500).json({ error: error.message, details: error });
      }
      res.json({ success: true, orders: data, count: data.length });
    } catch (error) {
      console.error('❌ Необработанная ошибка:', error);
      res.status(500).json({ error: error.message, details: error });
    }
  }

  /**
   * Получить расходы по заказам и рекламе, а также воронку продаж
   * GET /api/order-expenses?startDate=2024-01-01&endDate=2024-01-31&marketplace=all
   */
  async getOrderExpenses(req, res) {
    try {
      const { startDate, endDate, marketplace = 'all', article = null } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate и endDate обязательны' });
      }
      // Предполагается, что в sales_fact есть поля: ad_spend, logistics_cost, platform_fee, funnel_stage
      let query = supabase
        .from('sales_fact')
        .select('order_id, article, marketplace, order_date, ad_spend, logistics_cost, platform_fee, funnel_stage, total_amount')
        .gte('order_date', `${startDate}T00:00:00`)
        .lte('order_date', `${endDate}T23:59:59`);
      if (marketplace !== 'all') {
        query = query.eq('marketplace', marketplace);
      }
      if (article) {
        query = query.eq('article', article);
      }
      query = query.order('order_date', { ascending: true });
      const { data, error } = await query;
      if (error) {
        console.error('❌ Ошибка получения расходов по заказам:', error);
        return res.status(500).json({ error: error.message, details: error });
      }
      // Агрегация по стадиям воронки
      const funnel = {};
      data.forEach(item => {
        const stage = item.funnel_stage || 'unknown';
        if (!funnel[stage]) funnel[stage] = { count: 0, revenue: 0 };
        funnel[stage].count++;
        funnel[stage].revenue += item.total_amount || 0;
      });
      res.json({ success: true, expenses: data, funnel });
    } catch (error) {
      console.error('❌ Необработанная ошибка:', error);
      res.status(500).json({ error: error.message, details: error });
    }
  }
}

module.exports = new DataController();