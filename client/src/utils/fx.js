// Utility to fetch FX rates from the backend
// Usage: await getFxRate(date, base, target)
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';


// Always use CAD as intermediary if neither base nor target is CAD
export async function getFxRate(date, base, target) {
  if (base === target) return 1.0;
  // Direct or reciprocal for CAD pairs
  if (base === 'CAD' || target === 'CAD') {
    try {
      const res = await axios.get(`${API_BASE}/fx-rate`, {
        params: { date, base, target }
      });
      if (res.data && res.data.rate != null) return res.data.rate;
      // Try reciprocal
      const rev = await axios.get(`${API_BASE}/fx-rate`, {
        params: { date, base: target, target: base }
      });
      if (rev.data && rev.data.rate != null && rev.data.rate !== 0) return 1.0 / rev.data.rate;
      return null;
    } catch (err) {
      console.error('FX rate fetch error:', err);
      return null;
    }
  }
  // Otherwise, get base->CAD and CAD->target (with reciprocal fallback)
  const [toCad, fromCad] = await Promise.all([
    getFxRate(date, base, 'CAD'),
    getFxRate(date, 'CAD', target)
  ]);
  if (toCad == null || fromCad == null) return null;
  return toCad * fromCad;
}

// Batch fetch: accepts array of {date, base, target}, returns object key->rate (key = `${date}_${base}_${target}`)

// Batch fetch: supports CAD as intermediary for non-CAD pairs
export async function getFxRatesBatch(requests) {
  if (!Array.isArray(requests) || requests.length === 0) return {};
  const preset = {};
  const direct = [];
  const reciprocal = [];
  const indirect = [];
  requests.forEach(r => {
    if (!r || !r.date || !r.base || !r.target) return;
    if (r.base === r.target) {
      preset[`${r.date}_${r.base}_${r.target}`] = 1.0;
    } else if (r.base === 'CAD' || r.target === 'CAD') {
      direct.push(r);
      reciprocal.push({ date: r.date, base: r.target, target: r.base });
    } else {
      // Need both base->CAD and CAD->target
      indirect.push(r);
    }
  });
  // Fetch all direct pairs in one batch
  let directRates = {};
  if (direct.length) {
    try {
      const res = await axios.post(`${API_BASE}/fx-rates`, { requests: direct });
      directRates = res.data?.rates || {};
    } catch (err) {
      console.error('Batch FX rate fetch error:', err);
    }
  }
  // Fetch reciprocals for missing direct rates
  let reciprocalRates = {};
  if (reciprocal.length) {
    try {
      const res = await axios.post(`${API_BASE}/fx-rates`, { requests: reciprocal });
      reciprocalRates = res.data?.rates || {};
    } catch (err) {
      console.error('Batch FX reciprocal fetch error:', err);
    }
  }
  // For indirect, batch all needed base->CAD and CAD->target
  const needed = [];
  indirect.forEach(r => {
    needed.push({ date: r.date, base: r.base, target: 'CAD' });
    needed.push({ date: r.date, base: 'CAD', target: r.target });
  });
  let neededRates = {};
  if (needed.length) {
    try {
      const res = await axios.post(`${API_BASE}/fx-rates`, { requests: needed });
      neededRates = res.data?.rates || {};
    } catch (err) {
      console.error('Batch FX rate fetch error:', err);
    }
  }
  // Compose indirect rates
  indirect.forEach(r => {
    const toCad = neededRates[`${r.date}_${r.base}_CAD`];
    const fromCad = neededRates[`${r.date}_CAD_${r.target}`];
    if (toCad != null && fromCad != null) {
      preset[`${r.date}_${r.base}_${r.target}`] = toCad * fromCad;
    }
  });
  // Add direct rates, or use reciprocal if direct missing
  direct.forEach(r => {
    const key = `${r.date}_${r.base}_${r.target}`;
    if (directRates[key] != null) {
      preset[key] = directRates[key];
    } else {
      // Try reciprocal
      const revKey = `${r.date}_${r.target}_${r.base}`;
      if (reciprocalRates[revKey] != null && reciprocalRates[revKey] !== 0) {
        preset[key] = 1.0 / reciprocalRates[revKey];
      }
    }
  });
  return preset;
}
