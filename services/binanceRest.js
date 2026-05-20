const axios = require('axios');
const cache = require('./cache');

const API_URL = 'https://api.binance.com/api/v3/ticker/price';
const TIMEOUT_MS = 3000;

const PAIRS = [
  { pairSymbol: 'BTCUSDT', symbol: 'BTC' },
  { pairSymbol: 'ETHUSDT', symbol: 'ETH' },
  { pairSymbol: 'SOLUSDT', symbol: 'SOL' },
];

const PAIR_SET = new Set(PAIRS.map((p) => p.pairSymbol));

function cacheKey(symbol) {
  return `binance:${symbol}`;
}

function toPriceObject(symbol, price) {
  return {
    symbol,
    price,
    source: 'binance',
    timestamp: Date.now(),
  };
}

async function fetchPrices() {
  const cached = PAIRS.map(({ symbol }) => cache.get(cacheKey(symbol)));
  if (cached.every(Boolean)) {
    return cached;
  }

  let response;
  try {
    response = await axios.get(API_URL, { timeout: TIMEOUT_MS });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new Error('Binance REST API request timed out after 3000ms');
    }
    if (err.response) {
      throw new Error(`Binance REST API error: HTTP ${err.response.status}`);
    }
    throw new Error(`Binance REST API request failed: ${err.message}`);
  }

  const tickers = response.data;
  if (!Array.isArray(tickers)) {
    throw new Error('Binance REST API returned invalid response');
  }

  const byPair = Object.fromEntries(
    tickers
      .filter((t) => PAIR_SET.has(t.symbol))
      .map((t) => [t.symbol, t])
  );

  const results = [];
  for (const { pairSymbol, symbol } of PAIRS) {
    const ticker = byPair[pairSymbol];
    if (!ticker) {
      throw new Error(`Binance REST API missing ticker for ${symbol}`);
    }

    const price = parseFloat(ticker.price);
    if (!Number.isFinite(price)) {
      throw new Error(`Binance REST API invalid price for ${symbol}`);
    }

    const item = toPriceObject(symbol, price);
    cache.set(cacheKey(symbol), item);
    results.push(item);
  }

  return results;
}

module.exports = { fetchPrices };
