const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const originalQuery = pool.query.bind(pool);
pool.query = async (text, params) => {
  try {
    return await originalQuery(text, params);
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
};

module.exports = pool;
