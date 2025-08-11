// Utility to convert a balance to a target currency using the fx.js module
// Usage: await convertBalance({balance, currency, date}, targetCurrency)

const fx = require('./fx');

async function convertBalance({ balance, currency, date }, targetCurrency) {
  if (balance == null || !currency || !date || !targetCurrency) return null;
  if (currency === targetCurrency) return balance;
  const rate = await fx.getRate(date, currency, targetCurrency);
  if (rate == null) return null;
  return balance * rate;
}

module.exports = { convertBalance };
