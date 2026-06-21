const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = Router();
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const AUTHORS_PATH = path.join(PROJECT_ROOT, 'authors.txt');

async function seedAuthorTrackingIfEmpty() {
  const result = await pool.query('SELECT COUNT(*)::int as count FROM author_tracking');
  if (result.rows[0].count === 0) {
    const authors = fs
      .readFileSync(AUTHORS_PATH, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const author of authors) {
      await pool.query(
        'INSERT INTO author_tracking (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [author]
      );
    }
    console.log(`Seeded author_tracking table with ${authors.length} authors`);
  }
}

router.get('/api/settings/authors', async (req, res) => {
  try {
    await seedAuthorTrackingIfEmpty();
    const result = await pool.query('SELECT name, tracked FROM author_tracking ORDER BY name');
    res.json({ authors: result.rows });
  } catch (err) {
    console.error('Error fetching authors:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/settings/authors/toggle', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Author name is required' });
    await pool.query(
      'UPDATE author_tracking SET tracked = NOT tracked WHERE name = $1',
      [name]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error toggling author:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/settings', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'settings.html'));
});

module.exports = router;
module.exports.seedAuthorTrackingIfEmpty = seedAuthorTrackingIfEmpty;
