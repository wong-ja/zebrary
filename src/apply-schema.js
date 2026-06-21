require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { Pool } = require('@neondatabase/serverless');

async function applySchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await client.query(sql);
    console.log('Schema applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Schema apply failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applySchema();
