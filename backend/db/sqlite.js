const Database = require('better-sqlite3-sqlcipher');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'orthanc.db');
const dbKey = process.env.DB_KEY || '';

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

if (dbKey) {
  db.pragma(`key = "${dbKey.replace(/"/g, '""')}"`);
} else {
  console.warn('DB_KEY not set; database is not encrypted.');
}

module.exports = db;
