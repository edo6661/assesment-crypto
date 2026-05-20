const express = require('express');
const {
  getLatestPrice,
  getHistory,
  getStats,
  getWsStatus,
} = require('../services/binanceWs');

const router = express.Router();

const VALID_SYMBOLS = new Set(['BTC', 'ETH', 'SOL']);

function normalizeSymbol(param) {
  return String(param || '').toUpperCase();
}

function success(res, data) {
  res.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function failure(res, statusCode, message) {
  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}

router.get('/ws/status', async (req, res) => {
  try {
    const data = getWsStatus();
    success(res, data);
  } catch (err) {
    failure(res, 500, err.message);
  }
});

// History route MUST be registered before /price/:symbol (Express 5 path-to-regexp)
router.get('/price/:symbol/history', async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol);

    if (!VALID_SYMBOLS.has(symbol)) {
      failure(res, 400, `Invalid symbol: ${symbol}`);
      return;
    }

    const duration = parseInt(req.query.duration, 10) || 60;
    const data = getHistory(symbol, duration);
    success(res, data);
  } catch (err) {
    failure(res, 500, err.message);
  }
});

router.get('/price/:symbol', async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol);

    if (!VALID_SYMBOLS.has(symbol)) {
      failure(res, 400, `Invalid symbol: ${symbol}`);
      return;
    }

    const data = getLatestPrice(symbol);

    if (!data) {
      failure(res, 404, `No data yet for symbol ${symbol}`);
      return;
    }

    success(res, data);
  } catch (err) {
    failure(res, 500, err.message);
  }
});

router.get('/stats/:symbol', async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol);

    if (!VALID_SYMBOLS.has(symbol)) {
      failure(res, 400, `Invalid symbol: ${symbol}`);
      return;
    }

    const window = parseInt(req.query.window, 10) || 300;
    const data = getStats(symbol, window);
    success(res, data);
  } catch (err) {
    failure(res, 500, err.message);
  }
});

module.exports = router;
