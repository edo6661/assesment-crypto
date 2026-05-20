const coingecko = require('./coingecko');
const coincap = require('./coincap');
const binanceRest = require('./binanceRest');
const cache = require('./cache');

const SYMBOLS = ['BTC', 'ETH', 'SOL'];

const MOCK_PRICES = {
  BTC: 97000,
  ETH: 3500,
  SOL: 180,
};

const SOURCE_FETCHERS = [
  { source: 'coingecko', fetchPrices: coingecko.fetchPrices, cachePrefix: 'coingecko' },
  { source: 'coincap', fetchPrices: coincap.fetchPrices, cachePrefix: 'coincap' },
  { source: 'binance', fetchPrices: binanceRest.fetchPrices, cachePrefix: 'binance' },
];

function buildMockSource(source) {
  const prices = SYMBOLS.map((symbol) => ({
    symbol,
    price: MOCK_PRICES[symbol],
    source,
    timestamp: Date.now(),
  }));

  return { source, status: 'mock', prices, mock: true };
}

function buildMockResponse() {
  console.warn('[aggregator] All sources failed, using mock data');
  return {
    sources: SOURCE_FETCHERS.map(({ source }) => buildMockSource(source)),
    timestamp: Date.now(),
    mock: true,
  };
}

function clearSourceCache(prefix) {
  for (const symbol of SYMBOLS) {
    cache.del(`${prefix}:${symbol}`);
  }
}

async function fetchAllSources() {
  const results = await Promise.allSettled(
    SOURCE_FETCHERS.map(({ fetchPrices }) => fetchPrices())
  );

  const sources = results.map((result, index) => {
    const { source } = SOURCE_FETCHERS[index];

    if (result.status === 'fulfilled') {
      return { source, status: 'ok', prices: result.value };
    }

    return {
      source,
      status: 'error',
      error: result.reason?.message || 'unknown error',
      prices: [],
    };
  });

  const allFailed = sources.every((src) => src.status === 'error');
  if (allFailed) {
    return buildMockResponse();
  }

  return { sources, timestamp: Date.now() };
}

function computeSymbolStats(prices) {
  if (prices.length === 0) {
    return { avg: null, min: null, max: null, spread: null, spreadPct: null };
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const spread = max - min;
  const spreadPct = avg !== 0 ? (spread / avg) * 100 : 0;

  return {
    avg,
    min,
    max,
    spread,
    spreadPct: Math.round(spreadPct * 100) / 100,
  };
}

async function getAggregate() {
  const { sources } = await fetchAllSources();
  const result = { timestamp: Date.now() };

  for (const symbol of SYMBOLS) {
    const prices = [];

    for (const src of sources) {
      if (src.status !== 'ok' && src.status !== 'mock') continue;
      const item = src.prices.find((p) => p.symbol === symbol);
      if (item) prices.push(item.price);
    }

    result[symbol] = computeSymbolStats(prices);
  }

  return result;
}

async function checkSourceHealth({ fetchPrices, cachePrefix }) {
  const lastChecked = Date.now();
  clearSourceCache(cachePrefix);

  const start = Date.now();
  try {
    await fetchPrices();
    return {
      status: 'ok',
      latencyMs: Date.now() - start,
      lastChecked,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err.message,
      latencyMs: null,
      lastChecked,
    };
  }
}

async function getHealthStatus() {
  const checks = await Promise.all(
    SOURCE_FETCHERS.map((config) => checkSourceHealth(config))
  );

  return {
    coingecko: checks[0],
    coincap: checks[1],
    binance: checks[2],
  };
}

module.exports = {
  fetchAllSources,
  getAggregate,
  getHealthStatus,
};
