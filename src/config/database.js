const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool = null;

function createPool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  logger.info({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME
  }, 'Database pool created');

  return pool;
}

function getPool() {
  if (!pool) {
    return createPool();
  }
  return pool;
}

async function query(sql, params = []) {
  const db = getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function healthCheck() {
  try {
    const db = getPool();
    await db.execute('SELECT 1');
    return { status: 'ok', message: 'Database connection healthy' };
  } catch (err) {
    logger.error({ error: err.message }, 'Database health check failed');
    return { status: 'error', message: err.message };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

module.exports = {
  createPool,
  getPool,
  query,
  queryOne,
  healthCheck,
  closePool
};
