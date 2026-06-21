const pool = require('../db');

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = req.session.userId;
  pool.query('SELECT id FROM users WHERE id = $1', [req.session.userId]).then(result => {
    if (result.rows.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    next();
  }).catch(() => res.status(500).json({ error: 'Internal server error' }));
};

const optionalAuth = (req, res, next) => {
  if (req.session.userId) {
    req.userId = req.session.userId;
    pool.query('SELECT id FROM users WHERE id = $1', [req.session.userId]).then(result => {
      if (result.rows.length === 0) {
        req.session.destroy(() => {});
        delete req.userId;
      }
      next();
    }).catch(() => { next(); });
  } else {
    next();
  }
};

module.exports = { requireAuth, optionalAuth };
