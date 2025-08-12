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
