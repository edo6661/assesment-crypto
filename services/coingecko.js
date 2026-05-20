const axios = require('axios');
const cache = require('./cache');

const API_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';
const TIMEOUT_MS = 3000;

const ASSETS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
];

function cacheKey(symbol) {
  return `coingecko:${symbol}`;
}

function toPriceObject(symbol, price) {
  return {
    symbol,
    price,
    source: 'coingecko',
    timestamp: Date.now(),
  };
}

async function fetchPrices() {
  const cached = ASSETS.map(({ symbol }) => cache.get(cacheKey(symbol)));
  if (cached.every(Boolean)) {
    return cached;
  }

  let response;
  try {
    response = await axios.get(API_URL, { timeout: TIMEOUT_MS });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new Error('CoinGecko API request timed out after 3000ms');
    }
    if (err.response) {
      throw new Error(`CoinGecko API error: HTTP ${err.response.status}`);
    }
    throw new Error(`CoinGecko API request failed: ${err.message}`);
  }

  const data = response.data;
  if (!data || typeof data !== 'object') {
    throw new Error('CoinGecko API returned invalid response');
  }

  const results = [];
  for (const { id, symbol } of ASSETS) {
    const price = data[id]?.usd;
    if (typeof price !== 'number') {
      throw new Error(`CoinGecko API missing USD price for ${symbol}`);
    }

    const item = toPriceObject(symbol, price);
    cache.set(cacheKey(symbol), item);
    results.push(item);
  }

  return results;
}

module.exports = { fetchPrices };
