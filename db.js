const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'crypto-dashboard.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

module.exports = db;
