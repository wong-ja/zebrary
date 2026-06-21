const { Router } = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = Router();

router.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-50 characters alphanumeric (underscores allowed)' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const emailExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, password_hash, email]
    );

    const user = result.rows[0];

    await pool.query(
      `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    const genresData = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'genres.json'), 'utf-8'));
    if (genresData.whitelisted && genresData.whitelisted.length > 0) {
      await pool.query(
        'UPDATE user_settings SET whitelisted_genres = $1 WHERE user_id = $2',
        [JSON.stringify(genresData.whitelisted), user.id]
      );
    }
    if (genresData.blacklisted && genresData.blacklisted.length > 0) {
      await pool.query(
        'UPDATE user_settings SET blacklisted_genres = $1 WHERE user_id = $2',
        [JSON.stringify(genresData.blacklisted), user.id]
      );
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.status(201).json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ id: user.id, username: user.username });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

router.get('/api/auth/me', optionalAuth, async (req, res) => {
  if (req.session.userId) {
    try {
      const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.session.userId]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        req.session.username = user.username;
        return res.json({ id: user.id, username: user.username, email: user.email });
      }
    } catch (e) {
      return res.json({ id: req.session.userId, username: req.session.username, email: null });
    }
    res.json({ id: req.session.userId, username: req.session.username, email: null });
  } else {
    res.json({ id: null, username: null, email: null });
  }
});

module.exports = router;
