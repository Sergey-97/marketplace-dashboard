// frontend/js/api.js
class APIClient {
  constructor() {
    this.baseURL = 'https://marketplace-dashboard-1.onrender.com';
  }

  /**
   * Получить продажи за период
   */
  async getSales(startDate, endDate, options = {}) {
    const params = new URLSearchParams({
      startDate,
      endDate,
      marketplace: options.marketplace || 'all',
      groupBy: options.groupBy || 'day',
      article: options.article || ''
    });

    const response = await fetch(`${this.baseURL}/api/sales?${params}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Получить товары
   */
  async getProducts(options = {}) {
    const params = new URLSearchParams(options);
    const response = await fetch(`${this.baseURL}/api/products?${params}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Получить KPI
   */
  async getKPI(startDate, endDate, marketplace = 'all') {
    const params = new URLSearchParams({ startDate, endDate, marketplace });
    const response = await fetch(`${this.baseURL}/api/kpi?${params}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Запустить синхронизацию
   */
  async triggerSync(marketplace, dateFrom, dateTo) {
    const response = await fetch(`${this.baseURL}/api/sync/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketplace, dateFrom, dateTo })
    });
    return response.json();
  }
}

window.api = new APIClient();