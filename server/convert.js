// Utility to convert a balance to a target currency using the fx.js module
// Usage: await convertBalance({balance, currency, date}, targetCurrency)

const fx = require('./fx');

async function convertBalance({ balance, currency, date }, targetCurrency) {
  if (balance == null || !currency || !date || !targetCurrency) {
    console.warn(`[convertBalance] MISSING VALUE: balance=${balance}, currency=${currency}, date=${date}, targetCurrency=${targetCurrency}`);
    return null;
  }
  if (currency === targetCurrency) {
    console.log(`[convertBalance] NO CONVERSION NEEDED: ${balance} ${currency} (target ${targetCurrency})`);
    return balance;
  }
  console.log(`[convertBalance] Attempting to convert ${balance} from ${currency} to ${targetCurrency} on ${date}`);
  const rate = await fx.getRate(date, currency, targetCurrency);
  if (rate == null) {
    console.warn(`[convertBalance] NO RATE FOUND: ${currency}->${targetCurrency} on ${date}`);
    return null;
  }
  console.log(`[convertBalance] SUCCESS: ${balance} ${currency} to ${targetCurrency} at rate ${rate} = ${balance * rate}`);
  return balance * rate;
}

module.exports = { convertBalance };
