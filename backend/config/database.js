const db = require('../db/sqlite');
const { runMigrations } = require('../db/schema');

function initDB() {
  runMigrations();
  console.log('SQLite database ready');
}

module.exports = initDB;
