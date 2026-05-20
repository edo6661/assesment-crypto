const db = require('../db');

const DEFAULT_TTL_MS = 30 * 1000;

const getStmt = db.prepare(
  'SELECT value, expires_at FROM cache WHERE key = ?'
);
const setStmt = db.prepare(`
  INSERT INTO cache (key, value, expires_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    expires_at = excluded.expires_at
`);
const deleteStmt = db.prepare('DELETE FROM cache WHERE key = ?');

function get(key) {
  const row = getStmt.get(key);
  if (!row) return null;

  if (Date.now() > row.expires_at) {
    deleteStmt.run(key);
    return null;
  }

  return JSON.parse(row.value);
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  const expiresAt = Date.now() + ttlMs;
  setStmt.run(key, JSON.stringify(value), expiresAt);
}

function del(key) {
  deleteStmt.run(key);
}

module.exports = {
  get,
  set,
  del,
  DEFAULT_TTL_MS,
};
