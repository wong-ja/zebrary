const { Router } = require('express');
const pool = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = Router();

router.get('/api/books', optionalAuth, async (req, res) => {
  try {
    const { status, search, page, limit, author, genre, year_min, year_max } = req.query;
    const effectiveStatus = status || 'pending';
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const offset = (currentPage - 1) * pageLimit;

    let conditions = ['b.status = $1'];
    let params = [effectiveStatus];
    let paramIndex = 2;

    let countConditions = ['b.status = $1'];
    let countParams = [effectiveStatus];
    let countParamIndex = 2;

    if (req.userId) {
      params.push(req.userId);
      conditions.push(`(us.user_id = $${paramIndex} OR us.user_id IS NULL)`);
      paramIndex++;
    }

    if (search) {
      var searchClause = `(b.title ILIKE $${paramIndex} OR b.author ILIKE $${paramIndex} OR b.description ILIKE $${paramIndex})`;
      conditions.push(searchClause);
      countConditions.push(searchClause);
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (author) {
      var authors = author.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (authors.length > 0) {
        var authorClauses = authors.map(function (a, i) {
          params.push(a);
          countParams.push(a);
          return `b.author = $${paramIndex + i}`;
        });
        var authorClause = '(' + authorClauses.join(' OR ') + ')';
        conditions.push(authorClause);
        countConditions.push(authorClause);
        paramIndex += authors.length;
        countParamIndex += authors.length;
      }
    }

    if (genre) {
      var genres = genre.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (genres.length > 0) {
        var genreClauses = genres.map(function (g, i) {
          params.push(`%${g}%`);
          countParams.push(`%${g}%`);
          return `b.genre_tags::text ILIKE $${paramIndex + i}`;
        });
        var genreClause = '(' + genreClauses.join(' OR ') + ')';
        conditions.push(genreClause);
        countConditions.push(genreClause);
        paramIndex += genres.length;
        countParamIndex += genres.length;
      }
    }

    if (year_min) {
      var yearMinClause = `b.first_publish_year >= $${paramIndex}`;
      conditions.push(yearMinClause);
      countConditions.push(yearMinClause);
      params.push(parseInt(year_min, 10));
      countParams.push(parseInt(year_min, 10));
      paramIndex++;
      countParamIndex++;
    }

    if (year_max) {
      var yearMaxClause = `b.first_publish_year <= $${paramIndex}`;
      conditions.push(yearMaxClause);
      countConditions.push(yearMaxClause);
      params.push(parseInt(year_max, 10));
      countParams.push(parseInt(year_max, 10));
      paramIndex++;
      countParamIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const countWhereClause = countConditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM books b WHERE ${countWhereClause}`,
      countParams
    );
    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / pageLimit) || 1;

    const joinClause = req.userId
      ? `LEFT JOIN user_shelves us ON us.book_id = b.id AND us.user_id = $2`
      : `LEFT JOIN user_shelves us ON us.book_id = b.id AND us.user_id = 0`;

    const dataResult = await pool.query(
      `SELECT b.*, us.shelf as user_shelf
       FROM books b
       ${joinClause}
       WHERE ${whereClause}
       ORDER BY b.fetched_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageLimit, offset]
    );

    res.json({ books: dataResult.rows, total, page: currentPage, totalPages });
  } catch (err) {
    console.error('Error fetching books:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/books/filters', async (req, res) => {
  try {
    const authorsResult = await pool.query('SELECT DISTINCT author FROM books ORDER BY author');
    const genresResult = await pool.query(
      `SELECT DISTINCT jsonb_array_elements_text(genre_tags) AS genre FROM books ORDER BY genre`
    );

    res.json({
      authors: authorsResult.rows.map(r => r.author),
      genres: genresResult.rows.map(r => r.genre),
    });
  } catch (err) {
    console.error('Error fetching filters:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/shelve', requireAuth, async (req, res) => {
  try {
    const { bookId, shelf } = req.body;

    if (!bookId || !shelf) {
      return res.status(400).json({ error: 'bookId and shelf are required' });
    }

    if (!['tbr', 'wishlist', 'wont_read'].includes(shelf)) {
      return res.status(400).json({ error: 'Invalid shelf value' });
    }

    await pool.query(
      `INSERT INTO user_shelves (user_id, book_id, shelf) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, book_id) DO UPDATE SET shelf = $3`,
      [req.userId, bookId, shelf]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error shelving book:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/shelve/:bookId', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.params;

    await pool.query(
      'DELETE FROM user_shelves WHERE user_id = $1 AND book_id = $2',
      [req.userId, bookId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing shelf:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/books/stats', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT status, COUNT(*)::int as count FROM books GROUP BY status'
    );

    const stats = { whitelisted: 0, blacklisted: 0, pending: 0 };
    for (const row of result.rows) {
      stats[row.status] = row.count;
    }

    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
