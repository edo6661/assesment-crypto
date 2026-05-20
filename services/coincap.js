const axios = require('axios');
const cache = require('./cache');

const API_URL = 'https://api.coincap.io/v2/assets';
const TIMEOUT_MS = 3000;

const SYMBOLS = ['BTC', 'ETH', 'SOL'];

function cacheKey(symbol) {
  return `coincap:${symbol}`;
}

function toPriceObject(symbol, price) {
  return {
    symbol,
    price,
    source: 'coincap',
    timestamp: Date.now(),
  };
}

async function fetchPrices() {
  const cached = SYMBOLS.map((symbol) => cache.get(cacheKey(symbol)));
  if (cached.every(Boolean)) {
    return cached;
  }

  let response;
  try {
    response = await axios.get(API_URL, { timeout: TIMEOUT_MS });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new Error('CoinCap API request timed out after 3000ms');
    }
    if (err.response) {
      throw new Error(`CoinCap API error: HTTP ${err.response.status}`);
    }
    throw new Error(`CoinCap API request failed: ${err.message}`);
  }

  const assets = response.data?.data;
  if (!Array.isArray(assets)) {
    throw new Error('CoinCap API returned invalid response');
  }

  const results = [];
  for (const symbol of SYMBOLS) {
    const asset = assets.find((a) => a.symbol === symbol);
    if (!asset) {
      throw new Error(`CoinCap API missing data for ${symbol}`);
    }

    const price = parseFloat(asset.priceUsd);
    if (!Number.isFinite(price)) {
      throw new Error(`CoinCap API invalid price for ${symbol}`);
    }

    const item = toPriceObject(symbol, price);
    cache.set(cacheKey(symbol), item);
    results.push(item);
  }

  return results;
}

module.exports = { fetchPrices };
