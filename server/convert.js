// Utility to convert a balance to a target currency using the fx.js module
// Usage: await convertBalance({balance, currency, date}, targetCurrency)

const fx = require('./fx');

async function convertBalance({ balance, currency, date }, targetCurrency) {
  if (balance == null || !currency || !date || !targetCurrency) {
    console.warn(`convertBalance: missing value(s): balance=${balance}, currency=${currency}, date=${date}, targetCurrency=${targetCurrency}`);
    return null;
  }
  if (currency === targetCurrency) {
    console.log(`convertBalance: no conversion needed for ${balance} ${currency} (target ${targetCurrency})`);
    return balance;
  }
  const rate = await fx.getRate(date, currency, targetCurrency);
  if (rate == null) {
    console.warn(`convertBalance: no rate found for ${currency}->${targetCurrency} on ${date}`);
    return null;
  }
  console.log(`Converted ${balance} ${currency} to ${targetCurrency} at rate ${rate}`);
  return balance * rate;
}

module.exports = { convertBalance };
