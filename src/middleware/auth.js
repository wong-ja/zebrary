const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = req.session.userId;
  next();
};

const optionalAuth = (req, res, next) => {
  if (req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
};

module.exports = { requireAuth, optionalAuth };
