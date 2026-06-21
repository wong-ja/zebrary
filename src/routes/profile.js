const { Router } = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { runIngestion } = require('../ingestion/runner');
const fs = require('fs');
const path = require('path');

const router = Router();

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const AUTHORS_PATH = path.join(PROJECT_ROOT, 'authors.txt');

async function ensureUserSettings(userId) {
  const result = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  if (result.rows.length === 0) {
    const genresData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'genres.json'), 'utf-8'));
    await pool.query(
      `INSERT INTO user_settings (user_id, whitelisted_genres, blacklisted_genres)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, JSON.stringify(genresData.whitelisted || []), JSON.stringify(genresData.blacklisted || [])]
    );
  }
}

async function seedUserAuthors(userId) {
  const existing = await pool.query('SELECT COUNT(*)::int as cnt FROM user_authors WHERE user_id = $1', [userId]);
  if (existing.rows[0].cnt === 0) {
    const authors = fs.readFileSync(AUTHORS_PATH, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean);
    for (const author of authors) {
      await pool.query(
        'INSERT INTO user_authors (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING',
        [userId, author]
      );
    }
  }
}

router.get('/api/profile', requireAuth, async (req, res) => {
  try {
    await ensureUserSettings(req.userId);
    const userResult = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.userId]);
    const settingsResult = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
    res.json({ user: userResult.rows[0], settings: settingsResult.rows[0] || {} });
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/update', requireAuth, async (req, res) => {
  try {
    const { username, email } = req.body;
    if (username) {
      if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 3-50 characters alphanumeric (underscores allowed)' });
      }
      const existing = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, req.userId]);
      if (existing.rows.length > 0) return res.status(409).json({ error: 'Username already taken' });
    }
    if (email !== undefined && email !== null) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      if (email) {
        const emailExists = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.userId]);
        if (emailExists.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });
      }
    }
    const updates = [];
    const params = [];
    let idx = 1;
    if (username) { updates.push(`username = $${idx++}`); params.push(username); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); params.push(email || null); }
    if (updates.length === 0) return res.json({ success: true });
    params.push(req.userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    if (username) req.session.username = username;
    res.json({ success: true });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    const match = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const password_hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/profile/authors', requireAuth, async (req, res) => {
  try {
    await seedUserAuthors(req.userId);
    const result = await pool.query('SELECT id, name FROM user_authors WHERE user_id = $1 ORDER BY name', [req.userId]);
    res.json({ authors: result.rows });
  } catch (err) {
    console.error('Authors fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/authors', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Author name is required' });
    await pool.query(
      'INSERT INTO user_authors (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING',
      [req.userId, name.trim()]
    );
    const result = await pool.query('SELECT id, name FROM user_authors WHERE user_id = $1 AND name = $2', [req.userId, name.trim()]);
    res.status(201).json(result.rows[0] || { id: null, name: name.trim() });
  } catch (err) {
    console.error('Add author error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/profile/authors/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_authors WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete author error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/profile/genres', requireAuth, async (req, res) => {
  try {
    await ensureUserSettings(req.userId);
    const result = await pool.query('SELECT whitelisted_genres, blacklisted_genres FROM user_settings WHERE user_id = $1', [req.userId]);
    const row = result.rows[0] || {};
    res.json({
      whitelisted: row.whitelisted_genres || [],
      blacklisted: row.blacklisted_genres || [],
    });
  } catch (err) {
    console.error('Genres fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/genres/whitelist', requireAuth, async (req, res) => {
  try {
    const { genre } = req.body;
    if (!genre) return res.status(400).json({ error: 'Genre is required' });
    await pool.query(
      `UPDATE user_settings SET whitelisted_genres = (
        SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(whitelisted_genres || $1::jsonb)
      ) WHERE user_id = $2`,
      [JSON.stringify([genre]), req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Add whitelist genre error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/profile/genres/whitelist/:genre', requireAuth, async (req, res) => {
  try {
    const genre = decodeURIComponent(req.params.genre);
    await pool.query(
      `UPDATE user_settings SET whitelisted_genres = (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) FROM jsonb_array_elements_text(whitelisted_genres) AS value WHERE value <> $1
      ) WHERE user_id = $2`,
      [genre, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Remove whitelist genre error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/genres/blacklist', requireAuth, async (req, res) => {
  try {
    const { genre } = req.body;
    if (!genre) return res.status(400).json({ error: 'Genre is required' });
    await pool.query(
      `UPDATE user_settings SET blacklisted_genres = (
        SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(blacklisted_genres || $1::jsonb)
      ) WHERE user_id = $2`,
      [JSON.stringify([genre]), req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Add blacklist genre error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/profile/genres/blacklist/:genre', requireAuth, async (req, res) => {
  try {
    const genre = decodeURIComponent(req.params.genre);
    await pool.query(
      `UPDATE user_settings SET blacklisted_genres = (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) FROM jsonb_array_elements_text(blacklisted_genres) AS value WHERE value <> $1
      ) WHERE user_id = $2`,
      [genre, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Remove blacklist genre error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/years', requireAuth, async (req, res) => {
  try {
    const { year_min, year_max } = req.body;
    await pool.query(
      'UPDATE user_settings SET year_min = $1, year_max = $2 WHERE user_id = $3',
      [year_min || null, year_max || null, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Years update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/profile/shelves', requireAuth, async (req, res) => {
  try {
    await ensureUserSettings(req.userId);
    const result = await pool.query('SELECT custom_shelves FROM user_settings WHERE user_id = $1', [req.userId]);
    const row = result.rows[0] || {};
    res.json({ shelves: row.custom_shelves || [] });
  } catch (err) {
    console.error('Shelves fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/shelves', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Shelf name is required' });
    await pool.query(
      `UPDATE user_settings SET custom_shelves = (
        SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(custom_shelves || $1::jsonb)
      ) WHERE user_id = $2`,
      [JSON.stringify([name]), req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Add shelf error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/profile/shelves/:name', requireAuth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    await pool.query(
      `UPDATE user_settings SET custom_shelves = (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) FROM jsonb_array_elements_text(custom_shelves) AS value WHERE value <> $1
      ) WHERE user_id = $2`,
      [name, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Remove shelf error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/palette', requireAuth, async (req, res) => {
  try {
    const { navy, blue, gold, soft, pink } = req.body;
    const colors = {};
    if (navy) colors.navy = navy;
    if (blue) colors.blue = blue;
    if (gold) colors.gold = gold;
    if (soft) colors.soft = soft;
    if (pink) colors.pink = pink;
    await pool.query(
      `UPDATE user_settings SET palette_colors = $1 WHERE user_id = $2`,
      [JSON.stringify(colors), req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Palette update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/profile/ingest-status', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT ingest_count, ingest_date FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    const row = result.rows[0] || {};
    const today = new Date().toISOString().split('T')[0];
    const ingestDate = row.ingest_date || null;
    const ingestCount = (ingestDate === today) ? (row.ingest_count || 0) : 0;
    res.json({ canIngest: ingestCount < 2, ingestCount, ingestDate });
  } catch (err) {
    console.error('Ingest status error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profile/ingest-now', requireAuth, async (req, res) => {
  try {
    const settingsResult = await pool.query(
      'SELECT ingest_count, ingest_date FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    const row = settingsResult.rows[0] || {};
    const today = new Date().toISOString().split('T')[0];
    let ingestCount = 0;
    if (row.ingest_date === today) {
      ingestCount = row.ingest_count || 0;
    }
    if (ingestCount >= 2) {
      return res.status(429).json({ error: 'Daily ingestion limit reached (max 2)' });
    }

    await ensureUserSettings(req.userId);
    await seedUserAuthors(req.userId);

    const result = await runIngestion(req.userId);

    if (row.ingest_date === today) {
      await pool.query(
        'UPDATE user_settings SET ingest_count = ingest_count + 1 WHERE user_id = $1',
        [req.userId]
      );
    } else {
      await pool.query(
        'UPDATE user_settings SET ingest_count = 1, ingest_date = $1 WHERE user_id = $2',
        [today, req.userId]
      );
    }

    res.json({
      success: true,
      message: `Ingestion complete: ${result.new} new, ${result.errors} errors`,
    });
  } catch (err) {
    console.error('Ingestion trigger error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
