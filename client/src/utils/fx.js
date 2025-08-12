// Utility to fetch FX rates from the backend
// Usage: await getFxRate(date, base, target)
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export async function getFxRate(date, base, target) {
  if (base === target) return 1.0;
  try {
    const res = await axios.get(`${API_BASE}/fx-rate`, {
      params: { date, base, target }
    });
    return res.data && res.data.rate != null ? res.data.rate : null;
  } catch (err) {
    console.error('FX rate fetch error:', err);
    return null;
  }
}

// Batch fetch: accepts array of {date, base, target}, returns object key->rate (key = `${date}_${base}_${target}`)
export async function getFxRatesBatch(requests) {
  if (!Array.isArray(requests) || requests.length === 0) return {};
  // Shortcut same-currency requests
  const payload = [];
  const preset = {};
  requests.forEach(r => {
    if (!r || !r.date || !r.base || !r.target) return;
    if (r.base === r.target) {
      preset[`${r.date}_${r.base}_${r.target}`] = 1.0;
    } else {
      payload.push(r);
    }
  });
  if (payload.length === 0) return preset;
  try {
    const res = await axios.post(`${API_BASE}/fx-rates`, { requests: payload });
    return { ...preset, ...(res.data?.rates || {}) };
  } catch (err) {
    console.error('Batch FX rate fetch error:', err);
    return preset; // return what we have
  }
}
