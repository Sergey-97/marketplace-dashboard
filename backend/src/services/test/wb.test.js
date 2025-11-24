// backend/src/services/test/wb.test.js
const WBAPI = require('./wb.api');

async function testWB() {
  try {
    console.log('🧪 Тестирование WB API...');
    
    // Тест получения остатков
    const stocks = await WBAPI.getStocks();
    console.log('✓ Остатки получены:', stocks.length);
    
    // Тест получения продаж за последние 3 дня
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);
    
    const sales = await WBAPI.getSales(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    console.log('✓ Продажи получены:', sales.length);
    
    console.log('✅ Тест WB пройден!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Тест WB провален:', error.message);
    process.exit(1);
  }
}

testWB();