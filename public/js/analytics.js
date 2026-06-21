var darkMode = localStorage.getItem('zebrary-dark') === '1';
document.documentElement.classList.toggle('dark', darkMode);

var COLORS = ['#8390fa', '#fac748', '#f88dad', '#1d2f6f', '#f9e9ec', '#4ade80', '#f87171', '#60a5fa', '#c084fc', '#34d399'];

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function fetchJson(url) {
  var res = await fetch(url, { credentials: 'include' });
  return res.json();
}

function toggleDarkMode() {
  darkMode = !darkMode;
  document.documentElement.classList.toggle('dark', darkMode);
  localStorage.setItem('zebrary-dark', darkMode ? '1' : '0');
  updateDarkIcon();
}

function updateDarkIcon() {
  var icon = document.querySelector('#dark-toggle i');
  if (icon) {
    icon.setAttribute('data-lucide', darkMode ? 'sun' : 'moon');
    lucide.createIcons();
  }
}

function renderSummary(data) {
  var row = document.getElementById('summary-row');
  row.innerHTML = [
    { label: 'Total Books', value: data.totalBooks, icon: 'book-open', color: 'text-zeb-blue' },
    { label: 'Authors', value: data.authorCount, icon: 'users', color: 'text-zeb-pink' },
    { label: 'Genres', value: data.genreCount, icon: 'tag', color: 'text-zeb-gold' },
    { label: 'Shelved', value: data.shelvedCount, icon: 'bookmark', color: 'text-green-500' },
  ].map(function (item) {
    return '<div class="stat-card"><div class="flex items-center justify-center gap-2 mb-1"><i data-lucide="' + item.icon + '" class="w-5 h-5 ' + item.color + '"></i><span class="stat-value ' + item.color + '">' + item.value + '</span></div><p class="text-xs font-medium" style="color: var(--color-text-secondary);">' + item.label + '</p></div>';
  }).join('');
  lucide.createIcons();
}

function renderBarChart(containerId, data, maxColor) {
  var container = document.getElementById(containerId);
  if (!data || data.length === 0) {
    container.innerHTML = '<p class="text-sm" style="color: var(--color-text-secondary);">No data available</p>';
    return;
  }
  var maxVal = Math.max.apply(null, data.map(function (d) { return d.count; }));
  container.innerHTML = data.map(function (d, i) {
    var pct = Math.round((d.count / maxVal) * 100);
    var color = maxColor || COLORS[i % COLORS.length];
    return '<div class="bar-container"><span class="bar-label" title="' + escapeHtml(d.author || d.genre || d.status || d.shelf || '') + '">' + escapeHtml(d.author || d.genre || d.status || d.shelf || '') + '</span><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%; background-color:' + color + ';"></div></div><span class="text-xs font-medium" style="min-width:2rem; color: var(--color-text-secondary);">' + d.count + '</span></div>';
  }).join('');
}

function renderDonut(data, totalShelved) {
  var donut = document.getElementById('shelf-donut');
  var legend = document.getElementById('shelf-legend');
  var empty = document.getElementById('shelf-empty');
  var container = document.getElementById('shelf-chart');

  if (totalShelved === 0) {
    donut.classList.add('hidden');
    legend.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  donut.classList.remove('hidden');
  legend.classList.remove('hidden');
  empty.classList.add('hidden');

  var labels = { tbr: 'TBR', wishlist: 'Wishlist', wont_read: 'Won\'t Read' };
  var total = totalShelved;
  var cumulativePct = 0;
  var gradients = data.map(function (d, i) {
    var pct = Math.round((d.count / total) * 100);
    var start = cumulativePct;
    cumulativePct += pct;
    var label = labels[d.shelf] || d.shelf;
    var color = COLORS[i % COLORS.length];
    return { start: start, end: cumulativePct, pct: pct, color: color, label: label, count: d.count };
  });

  donut.style.background = 'conic-gradient(' + gradients.map(function (g) {
    return g.color + ' ' + g.start + '% ' + g.end + '%';
  }).join(', ') + ')';

  legend.innerHTML = gradients.map(function (g) {
    return '<div class="legend-item"><span class="legend-swatch" style="background-color:' + g.color + ';"></span><span style="color: var(--color-text);">' + escapeHtml(g.label) + '</span><span style="color: var(--color-text-secondary);">(' + g.count + ')</span></div>';
  }).join('');
}

function renderStatus(data) {
  var container = document.getElementById('status-chart');
  if (!data || data.length === 0) {
    container.innerHTML = '<p class="text-sm" style="color: var(--color-text-secondary);">No data available</p>';
    return;
  }
  var labels = { whitelisted: 'Whitelisted', blacklisted: 'Blacklisted', pending: 'Pending' };
  var colors = { whitelisted: '#4ade80', blacklisted: '#f87171', pending: '#fac748' };
  var items = data.map(function (d) {
    return { label: labels[d.status] || d.status, count: d.count, color: colors[d.status] || '#8390fa' };
  });
  renderBarChart('status-chart', items.map(function (d) { return { genre: d.label, count: d.count, status: d.label }; }), '#8390fa');
}

async function init() {
  updateDarkIcon();
  document.getElementById('dark-toggle').addEventListener('click', toggleDarkMode);

  document.getElementById('loading-screen').classList.add('hidden');

  var authData = await fetchJson('/api/auth/me');
  if (authData && authData.id) {
    document.getElementById('username-display').textContent = authData.username;
    document.getElementById('logout-btn').classList.remove('hidden');
  } else {
    document.getElementById('auth-buttons').classList.remove('hidden');
  }

  document.getElementById('logout-btn').addEventListener('click', async function () {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
    window.location.href = '/';
  });

  var summary = await fetchJson('/api/analytics/summary');
  renderSummary(summary);

  var byAuthor = await fetchJson('/api/analytics/by-author');
  renderBarChart('author-chart', byAuthor.data, '#8390fa');

  var byGenre = await fetchJson('/api/analytics/by-genre');
  renderBarChart('genre-chart', byGenre.data, '#fac748');

  var byStatus = await fetchJson('/api/analytics/by-status');
  renderStatus(byStatus.data);

  var byShelf = await fetchJson('/api/analytics/by-shelf').catch(function () { return null; });
  if (byShelf) {
    renderDonut(byShelf.data, byShelf.totalShelved);
  } else {
    document.getElementById('shelf-chart').innerHTML = '<p class="text-sm text-center py-8" style="color: var(--color-text-secondary);">Sign in to see your shelf breakdown.</p>';
  }
}

document.addEventListener('DOMContentLoaded', init);
