require('dotenv/config');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./db');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(express.json());

app.use(session({
  store: new PgSession({ pool }),
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
}));

const authRoutes = require('./routes/auth');
app.use(authRoutes);

const ingestionRoutes = require('./routes/ingestion');
app.use(ingestionRoutes);

const dashboardRoutes = require('./routes/dashboard');
app.use(dashboardRoutes);

const sharedRoutes = require('./routes/shared');
app.use(sharedRoutes);

const searchRoutes = require('./routes/search');
app.use(searchRoutes);

const settingsRoutes = require('./routes/settings');
app.use(settingsRoutes);

const profileRoutes = require('./routes/profile');
app.use(profileRoutes);

const analyticsRoutes = require('./routes/analytics');
app.use(analyticsRoutes);

app.get('/shared/:userId', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'shared.html'));
});

app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '..', 'views', 'landing.html'));
});

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
});

app.get('/tbr', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
});

app.get('/wish', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
});

app.get('/profile', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'views', 'profile.html'));
});

app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'analytics.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
  const { seedAuthorTrackingIfEmpty } = require('./routes/settings');
  seedAuthorTrackingIfEmpty().catch(e => console.error('Seed error:', e.message));
  const { startCron } = require('./ingestion/cron');
  startCron();
}

module.exports = app;
