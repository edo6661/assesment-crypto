const WebSocket = require('ws');

const WS_URL = 'wss://stream.binance.com:9443/ws';
const BUFFER_MAX_MS = 300 * 1000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

const SYMBOLS = ['BTC', 'ETH', 'SOL'];
const MOCK_PRICES = { BTC: 97000, ETH: 3500, SOL: 180 };
const MOCK_NOISE_PCT = 0.005;
const MOCK_TICK_INTERVAL_MS = 5000;
const MAX_CONNECT_ATTEMPTS = 3;
const BINANCE_TO_SYMBOL = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
};

const SUBSCRIBE_MSG = JSON.stringify({
  method: 'SUBSCRIBE',
  params: ['btcusdt@ticker', 'ethusdt@ticker', 'solusdt@ticker'],
  id: 1,
});

const buffers = Object.fromEntries(SYMBOLS.map((s) => [s, []]));

const state = {
  connected: false,
  reconnectAttempts: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
};

let ws = null;
let reconnectTimer = null;
let mockTickTimer = null;
let started = false;

function normalizeSymbol(symbol) {
  const s = String(symbol || '').toUpperCase();
  return SYMBOLS.includes(s) ? s : null;
}

function pruneBuffer(symbol) {
  const cutoff = Date.now() - BUFFER_MAX_MS;
  const buf = buffers[symbol];
  while (buf.length > 0 && buf[0].timestamp < cutoff) {
    buf.shift();
  }
}

function addTick(symbol, price) {
  buffers[symbol].push({ price, timestamp: Date.now() });
  pruneBuffer(symbol);
}

function priceWithNoise(base) {
  const factor = 1 + (Math.random() * 2 - 1) * MOCK_NOISE_PCT;
  return base * factor;
}

function injectMockTicks() {
  for (const symbol of SYMBOLS) {
    addTick(symbol, priceWithNoise(MOCK_PRICES[symbol]));
  }
}

function startMockTicks() {
  if (mockTickTimer) return;
  console.warn('[binanceWs] WS failed after 3 attempts, using mock ticks');
  injectMockTicks();
  mockTickTimer = setInterval(injectMockTicks, MOCK_TICK_INTERVAL_MS);
}

function stopMockTicks() {
  if (!mockTickTimer) return;
  clearInterval(mockTickTimer);
  mockTickTimer = null;
}

function subscribe() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(SUBSCRIBE_MSG);
  }
}

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.e !== '24hrTicker') return;

  const symbol = BINANCE_TO_SYMBOL[msg.s];
  if (!symbol) return;

  const price = parseFloat(msg.c);
  if (!Number.isFinite(price)) return;

  addTick(symbol, price);
}

function getBackoffDelay() {
  return Math.min(
    INITIAL_BACKOFF_MS * Math.pow(2, state.reconnectAttempts),
    MAX_BACKOFF_MS
  );
}

function scheduleReconnect() {
  if (!started) return;
  if (reconnectTimer) return;

  const delay = getBackoffDelay();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    state.reconnectAttempts += 1;
    if (state.reconnectAttempts >= MAX_CONNECT_ATTEMPTS) {
      startMockTicks();
    }
    connect();
  }, delay);
}

function connect() {
  if (
    ws &&
    (ws.readyState === WebSocket.CONNECTING ||
      ws.readyState === WebSocket.OPEN)
  ) {
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopMockTicks();
    state.connected = true;
    state.reconnectAttempts = 0;
    state.lastConnectedAt = Date.now();
    subscribe();
  });

  ws.on('message', handleMessage);

  ws.on('close', () => {
    state.connected = false;
    state.lastDisconnectedAt = Date.now();
    ws = null;
    if (state.reconnectAttempts >= MAX_CONNECT_ATTEMPTS) {
      startMockTicks();
    }
    scheduleReconnect();
  });

  ws.on('error', () => {
    ws?.close();
  });
}

function startWs() {
  if (started) return;
  started = true;
  injectMockTicks();
  connect();
}

function getLatestPrice(symbol) {
  const s = normalizeSymbol(symbol);
  if (!s) return null;
  const buf = buffers[s];
  return buf.length > 0 ? buf[buf.length - 1] : null;
}

function getHistory(symbol, durationSecs) {
  const s = normalizeSymbol(symbol);
  if (!s) return [];
  const cutoff = Date.now() - durationSecs * 1000;
  return buffers[s].filter((tick) => tick.timestamp >= cutoff);
}

function getStats(symbol, windowSecs) {
  const ticks = getHistory(symbol, windowSecs);
  if (ticks.length === 0) {
    return { min: null, max: null, avg: null, count: 0 };
  }

  let min = ticks[0].price;
  let max = ticks[0].price;
  let sum = 0;

  for (const tick of ticks) {
    if (tick.price < min) min = tick.price;
    if (tick.price > max) max = tick.price;
    sum += tick.price;
  }

  return {
    min,
    max,
    avg: sum / ticks.length,
    count: ticks.length,
  };
}

function getWsStatus() {
  return {
    connected: state.connected,
    reconnectAttempts: state.reconnectAttempts,
    lastConnectedAt: state.lastConnectedAt,
    lastDisconnectedAt: state.lastDisconnectedAt,
  };
}

module.exports = {
  getLatestPrice,
  getHistory,
  getStats,
  getWsStatus,
  startWs,
};
