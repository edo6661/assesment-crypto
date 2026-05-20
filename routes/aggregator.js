const express = require('express');
const {
  fetchAllSources,
  getAggregate,
  getHealthStatus,
} = require('../services/aggregator');

const router = express.Router();

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

router.get('/data', async (req, res) => {
  try {
    const data = await fetchAllSources();
    success(res, data);
  } catch (err) {
    failure(res, 500, err.message);
  }
});

router.get('/aggregate', async (req, res) => {
  try {
    const data = await getAggregate();
    success(res, data);
  } catch (err) {
    failure(res, 500, err.message);
  }
});

router.get('/health', async (req, res) => {
  try {
    const data = await getHealthStatus();
    success(res, data);
  } catch (err) {
    failure(res, 500, err.message);
  }
});

module.exports = router;
