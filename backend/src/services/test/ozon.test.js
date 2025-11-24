// backend/src/services/test/ozon.test.js
const OzonAPI = require('./ozon.api');

async function testOzon() {
  try {
    console.log('🧪 Тестирование OZON API...');
    
    // Тест получения товаров
    const products = await OzonAPI.getProducts();
    console.log('✓ Товары получены:', products.length);
    
    // Тест получения заказов за последние 3 дня
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);
    
    const orders = await OzonAPI.getOrders(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    console.log('✓ Заказы получены:', orders.length);
    
    console.log('✅ Тест OZON пройден!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Тест OZON провален:', error.message);
    process.exit(1);
  }
}

testOzon();