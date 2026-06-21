const { Router } = require('express');
const pool = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = Router();

router.get('/api/books', optionalAuth, async (req, res) => {
  try {
    const { status, search, page, limit, author, genre, year_min, year_max, shelf } = req.query;
    const effectiveStatus = status || 'pending';
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const offset = (currentPage - 1) * pageLimit;

    const shelfMode = !!shelf;
    let conditions, params, paramIndex;
    let countConditions, countParams;
    var joinClause, countFromClause;

    if (shelfMode) {
      if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
      conditions = ['us.user_id = $1', 'us.shelf = $2'];
      params = [req.userId, shelf];
      paramIndex = 3;
      countConditions = ['us.user_id = $1', 'us.shelf = $2'];
      countParams = [req.userId, shelf];
      joinClause = 'JOIN user_shelves us ON us.book_id = b.id';
      countFromClause = 'books b JOIN user_shelves us ON us.book_id = b.id';
    } else {
      conditions = ['b.status = $1'];
      params = [effectiveStatus];
      paramIndex = 2;
      countConditions = ['b.status = $1'];
      countParams = [effectiveStatus];
      countFromClause = 'books b';
      if (req.userId) {
        params.push(req.userId);
        conditions.push('(us.user_id = $' + paramIndex + ' OR us.user_id IS NULL)');
        paramIndex++;
      }
      joinClause = req.userId
        ? 'LEFT JOIN user_shelves us ON us.book_id = b.id AND us.user_id = $2'
        : 'LEFT JOIN user_shelves us ON us.book_id = b.id AND us.user_id = 0';
    }

    if (search) {
      var searchClause = '(b.title ILIKE $' + paramIndex + ' OR b.author ILIKE $' + paramIndex + ' OR b.description ILIKE $' + paramIndex + ')';
      conditions.push(searchClause);
      countConditions.push(searchClause);
      params.push('%' + search + '%');
      countParams.push('%' + search + '%');
      paramIndex++;
    }

    if (author) {
      var authors = author.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (authors.length > 0) {
        var authorClauses = authors.map(function (a, i) {
          params.push(a);
          countParams.push(a);
          return 'b.author = $' + (paramIndex + i);
        });
        var authorClause = '(' + authorClauses.join(' OR ') + ')';
        conditions.push(authorClause);
        countConditions.push(authorClause);
        paramIndex += authors.length;
      }
    }

    if (genre) {
      var genres = genre.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (genres.length > 0) {
        var genreClauses = genres.map(function (g, i) {
          params.push('%' + g + '%');
          countParams.push('%' + g + '%');
          return 'b.genre_tags::text ILIKE $' + (paramIndex + i);
        });
        var genreClause = '(' + genreClauses.join(' OR ') + ')';
        conditions.push(genreClause);
        countConditions.push(genreClause);
        paramIndex += genres.length;
      }
    }

    if (year_min) {
      var yearMinClause = 'b.first_publish_year >= $' + paramIndex;
      conditions.push(yearMinClause);
      countConditions.push(yearMinClause);
      params.push(parseInt(year_min, 10));
      countParams.push(parseInt(year_min, 10));
      paramIndex++;
    }

    if (year_max) {
      var yearMaxClause = 'b.first_publish_year <= $' + paramIndex;
      conditions.push(yearMaxClause);
      countConditions.push(yearMaxClause);
      params.push(parseInt(year_max, 10));
      countParams.push(parseInt(year_max, 10));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const countWhereClause = countConditions.join(' AND ');

    const countResult = await pool.query(
      'SELECT COUNT(*)::int as total FROM ' + countFromClause + ' WHERE ' + countWhereClause,
      countParams
    );
    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / pageLimit) || 1;

    const groupByClause = 'GROUP BY b.id, b.external_id, b.source, b.title, b.author, b.description, b.cover_url, b.first_publish_year, b.genre_tags, b.status, b.source_url, b.fetched_at';
    const selectFields = "b.*, COALESCE(ARRAY_REMOVE(ARRAY_AGG(us.shelf ORDER BY us.shelf), NULL), ARRAY[]::text[]) as user_shelves";

    const dataResult = await pool.query(
      'SELECT ' + selectFields + ' FROM books b ' + joinClause + ' WHERE ' + whereClause + ' ' + groupByClause + ' ORDER BY b.fetched_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1),
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

    if (!['tbr', 'wishlist'].includes(shelf)) {
      return res.status(400).json({ error: 'Invalid shelf value' });
    }

    const existing = await pool.query(
      'SELECT id FROM user_shelves WHERE user_id = $1 AND book_id = $2 AND shelf = $3',
      [req.userId, bookId, shelf]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM user_shelves WHERE id = $1', [existing.rows[0].id]);
      res.json({ action: 'removed' });
    } else {
      await pool.query(
        'INSERT INTO user_shelves (user_id, book_id, shelf) VALUES ($1, $2, $3)',
        [req.userId, bookId, shelf]
      );
      res.json({ action: 'added' });
    }
  } catch (err) {
    console.error('Error shelving book:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/shelve/:bookId/:shelf', requireAuth, async (req, res) => {
  try {
    const { bookId, shelf } = req.params;

    await pool.query(
      'DELETE FROM user_shelves WHERE user_id = $1 AND book_id = $2 AND shelf = $3',
      [req.userId, bookId, shelf]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing shelf:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/api/books/:bookId/status', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { status } = req.body;
    if (!['pending', 'whitelisted', 'blacklisted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    await pool.query('UPDATE books SET status = $1 WHERE id = $2', [status, bookId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating book status:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/books/blacklist/:bookId', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    await pool.query(
      'UPDATE books SET status = $1 WHERE id = $2',
      ['blacklisted', bookId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error blacklisting book:', err.message);
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
