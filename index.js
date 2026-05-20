const express = require('express');
const path = require('path');
const aggregatorRouter = require('./routes/aggregator');
const trackerRouter = require('./routes/tracker');
const { startWs } = require('./services/binanceWs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', aggregatorRouter);
app.use('/api', trackerRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('Starting Binance WebSocket connection...');
  startWs();
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}, closing server...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
