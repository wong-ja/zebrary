const { Router } = require('express');
const pool = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = Router();

router.get('/api/analytics/summary', optionalAuth, async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*)::int as count FROM books');
    const totalBooks = totalResult.rows[0].count;

    const authorResult = await pool.query('SELECT COUNT(DISTINCT author)::int as count FROM books');
    const authorCount = authorResult.rows[0].count;

    const genreResult = await pool.query(
      "SELECT COUNT(DISTINCT genre)::int as count FROM (SELECT jsonb_array_elements_text(genre_tags) AS genre FROM books WHERE genre_tags IS NOT NULL) sub"
    );
    const genreCount = genreResult.rows[0].count;

    let shelvedCount = 0;
    if (req.userId) {
      const shelfResult = await pool.query(
        'SELECT COUNT(*)::int as count FROM user_shelves WHERE user_id = $1',
        [req.userId]
      );
      shelvedCount = shelfResult.rows[0].count;
    }

    res.json({ totalBooks, authorCount, genreCount, shelvedCount });
  } catch (err) {
    console.error('Analytics summary error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/analytics/by-author', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT author, COUNT(*)::int as count FROM books GROUP BY author ORDER BY count DESC LIMIT 20'
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Analytics by-author error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/analytics/by-genre', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT genre, COUNT(*)::int as count FROM (
        SELECT jsonb_array_elements_text(genre_tags) AS genre FROM books WHERE genre_tags IS NOT NULL
      ) sub WHERE genre IS NOT NULL GROUP BY genre ORDER BY count DESC LIMIT 20`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Analytics by-genre error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/analytics/by-shelf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT shelf, COUNT(*)::int as count FROM user_shelves WHERE user_id = $1 GROUP BY shelf ORDER BY count DESC`,
      [req.userId]
    );
    const totalShelved = result.rows.reduce((sum, r) => sum + r.count, 0);
    res.json({ data: result.rows, totalShelved });
  } catch (err) {
    console.error('Analytics by-shelf error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/analytics/by-status', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT status, COUNT(*)::int as count FROM books GROUP BY status ORDER BY count DESC'
    );
    const stats = { whitelisted: 0, blacklisted: 0, pending: 0 };
    for (const row of result.rows) {
      if (stats[row.status] !== undefined) stats[row.status] = row.count;
    }
    res.json({ data: result.rows, stats });
  } catch (err) {
    console.error('Analytics by-status error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
