const { Router } = require('express');
const pool = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = Router();

router.get('/api/shared/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.json({ userId: parseInt(userId), username: null, books: [] });
    }

    const username = userResult.rows[0].username;

    const booksResult = await pool.query(`
      SELECT b.*, ARRAY_AGG(us.shelf ORDER BY us.shelf) as shelves
      FROM user_shelves us
      JOIN books b ON b.id = us.book_id
      WHERE us.user_id = $1
      GROUP BY b.id, b.external_id, b.source, b.title, b.author, b.description, b.cover_url, b.first_publish_year, b.genre_tags, b.status, b.source_url, b.fetched_at
      ORDER BY MAX(us.created_at) DESC
    `, [userId]);

    res.json({ userId: parseInt(userId), username, books: booksResult.rows });
  } catch (err) {
    console.error('Error fetching shared books:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
