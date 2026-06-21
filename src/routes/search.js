const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { tagBook } = require('../ingestion/tagger');

const router = Router();

router.get('/api/search-external', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return res.status(502).json({ error: 'External search failed' });
    }

    const data = await response.json();
    const docs = data.docs || [];

    const results = docs.map((doc) => ({
      external_id: doc.key,
      source: 'openlibrary',
      title: doc.title,
      author: (doc.author_name && doc.author_name[0]) || 'Unknown',
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null,
      genre_tags: doc.subject || [],
      source_url: `https://openlibrary.org${doc.key}`,
      first_publish_year: doc.first_publish_year || null,
      description: null,
    }));

    res.json({ results });
  } catch (err) {
    console.error('External search error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/books', requireAuth, async (req, res) => {
  try {
    const { external_id, source, title, author, cover_url, genre_tags, source_url, first_publish_year, description } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: 'Title and author are required' });
    }

    const genreTags = Array.isArray(genre_tags) ? genre_tags : [];
    const status = 'whitelisted';

    const result = await pool.query(
      `INSERT INTO books (external_id, source, title, author, description, cover_url, first_publish_year, genre_tags, status, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       ON CONFLICT (external_id, source) DO UPDATE SET
         title = EXCLUDED.title,
         author = EXCLUDED.author,
         cover_url = EXCLUDED.cover_url,
         first_publish_year = EXCLUDED.first_publish_year,
         genre_tags = EXCLUDED.genre_tags,
         status = EXCLUDED.status,
         source_url = EXCLUDED.source_url,
         description = EXCLUDED.description
       RETURNING *`,
      [
        external_id || 'manual-' + Date.now(),
        source || 'manual',
        title,
        author,
        description || null,
        cover_url || null,
        first_publish_year || null,
        JSON.stringify(genreTags),
        status,
        source_url || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding book:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
