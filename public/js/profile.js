var state = {
  darkMode: false,
  authors: [],
  whitelisted: [],
  blacklisted: [],
  shelves: [],
};

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  document.documentElement.classList.toggle('dark', state.darkMode);
  localStorage.setItem('zebrary-dark', state.darkMode ? '1' : '0');
  updateDarkIcon();
}

function updateDarkIcon() {
  var icon = document.querySelector('#dark-toggle i');
  if (icon) {
    icon.setAttribute('data-lucide', state.darkMode ? 'sun' : 'moon');
    lucide.createIcons();
  }
}

function showMessage(id, text, type) {
  var el = document.getElementById(id);
  el.textContent = text;
  el.className = 'text-sm mt-2 ' + (type === 'error' ? 'text-red-600' : 'text-green-600');
  el.classList.remove('hidden');
  setTimeout(function () { el.classList.add('hidden'); }, 4000);
}

async function fetchProfile() {
  try {
    var res = await fetch('/api/profile', { credentials: 'include' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    var data = await res.json();
    document.getElementById('profile-username').value = data.user.username || '';
    document.getElementById('profile-email').value = data.user.email || '';
    document.getElementById('username-display').textContent = data.user.username || '';
  } catch (e) { console.error(e); }
}

async function fetchAuthors() {
  try {
    var res = await fetch('/api/profile/authors', { credentials: 'include' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    var data = await res.json();
    state.authors = data.authors || [];
    renderAuthors();
  } catch (e) { console.error(e); }
}

function renderAuthors() {
  var list = document.getElementById('authors-list');
  if (state.authors.length === 0) {
    list.innerHTML = '<p class="text-sm" style="color: var(--color-text-secondary);">No authors yet. Add some above.</p>';
    return;
  }
  list.innerHTML = state.authors.map(function (a) {
    return '<div class="flex items-center justify-between px-3 py-2 rounded-lg" style="background-color: var(--color-bg);">' +
      '<span class="text-sm font-medium" style="color: var(--color-text);">' + escapeHtml(a.name) + '</span>' +
      '<button data-author-id="' + a.id + '" class="delete-author text-red-500 hover:text-red-700 p-1" aria-label="Remove ' + escapeHtml(a.name) + '"><i data-lucide="x" class="w-4 h-4"></i></button>' +
      '</div>';
  }).join('');
  lucide.createIcons();
}

async function addAuthor() {
  var input = document.getElementById('author-input');
  var name = input.value.trim();
  if (!name) return;
  try {
    var res = await fetch('/api/profile/authors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name }),
      credentials: 'include',
    });
    if (res.ok) {
      input.value = '';
      fetchAuthors();
    }
  } catch (e) { console.error(e); }
}

async function deleteAuthor(id) {
  try {
    await fetch('/api/profile/authors/' + id, { method: 'DELETE', credentials: 'include' });
    fetchAuthors();
  } catch (e) { console.error(e); }
}

async function fetchGenres() {
  try {
    var res = await fetch('/api/profile/genres', { credentials: 'include' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    var data = await res.json();
    state.whitelisted = data.whitelisted || [];
    state.blacklisted = data.blacklisted || [];
    renderGenres();
  } catch (e) { console.error(e); }
}

function renderGenres() {
  var wl = document.getElementById('whitelist-genres');
  var bl = document.getElementById('blacklist-genres');
  wl.innerHTML = state.whitelisted.map(function (g) {
    return '<span class="genre-pill">' + escapeHtml(g) + '<span data-genre="' + escapeHtml(g) + '" data-list="whitelist" class="remove-genre" aria-label="Remove ' + escapeHtml(g) + '"><i data-lucide="x" class="w-3 h-3"></i></span></span>';
  }).join('') || '<span class="text-xs" style="color: var(--color-text-secondary);">None</span>';
  bl.innerHTML = state.blacklisted.map(function (g) {
    return '<span class="genre-pill">' + escapeHtml(g) + '<span data-genre="' + escapeHtml(g) + '" data-list="blacklist" class="remove-genre" aria-label="Remove ' + escapeHtml(g) + '"><i data-lucide="x" class="w-3 h-3"></i></span></span>';
  }).join('') || '<span class="text-xs" style="color: var(--color-text-secondary);">None</span>';
  lucide.createIcons();
}

async function addGenre(list, inputId) {
  var input = document.getElementById(inputId);
  var genre = input.value.trim();
  if (!genre) return;
  var endpoint = list === 'whitelist' ? '/api/profile/genres/whitelist' : '/api/profile/genres/blacklist';
  try {
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre: genre }),
      credentials: 'include',
    });
    if (res.ok) {
      input.value = '';
      fetchGenres();
    }
  } catch (e) { console.error(e); }
}

async function removeGenre(genre, list) {
  var endpoint = list === 'whitelist' ? '/api/profile/genres/whitelist/' : '/api/profile/genres/blacklist/';
  try {
    await fetch(endpoint + encodeURIComponent(genre), { method: 'DELETE', credentials: 'include' });
    fetchGenres();
  } catch (e) { console.error(e); }
}

async function fetchShelves() {
  try {
    var res = await fetch('/api/profile/shelves', { credentials: 'include' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    var data = await res.json();
    state.shelves = data.shelves || [];
    renderShelves();
  } catch (e) { console.error(e); }
}

function renderShelves() {
  var list = document.getElementById('shelves-list');
  list.innerHTML = state.shelves.map(function (s) {
    return '<span class="genre-pill">' + escapeHtml(s) + '<span data-shelf="' + escapeHtml(s) + '" class="remove-shelf" aria-label="Remove ' + escapeHtml(s) + '"><i data-lucide="x" class="w-3 h-3"></i></span></span>';
  }).join('');
  lucide.createIcons();
}

async function addShelf() {
  var input = document.getElementById('shelf-input');
  var name = input.value.trim();
  if (!name) return;
  try {
    var res = await fetch('/api/profile/shelves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name }),
      credentials: 'include',
    });
    if (res.ok) {
      input.value = '';
      fetchShelves();
    }
  } catch (e) { console.error(e); }
}

async function removeShelf(name) {
  try {
    await fetch('/api/profile/shelves/' + encodeURIComponent(name), { method: 'DELETE', credentials: 'include' });
    fetchShelves();
  } catch (e) { console.error(e); }
}

async function fetchYears() {
  try {
    var res = await fetch('/api/profile', { credentials: 'include' });
    if (res.status === 401) return;
    var data = await res.json();
    if (data.settings) {
      document.getElementById('year-min').value = data.settings.year_min || '';
      document.getElementById('year-max').value = data.settings.year_max || '';
    }
  } catch (e) { console.error(e); }
}

async function fetchPalette() {
  try {
    var res = await fetch('/api/profile', { credentials: 'include' });
    if (res.status === 401) return;
    var data = await res.json();
    if (data.settings && data.settings.palette_colors) {
      var colors = typeof data.settings.palette_colors === 'string' ? JSON.parse(data.settings.palette_colors) : data.settings.palette_colors;
      if (colors.navy) document.getElementById('color-navy').value = colors.navy;
      if (colors.blue) document.getElementById('color-blue').value = colors.blue;
      if (colors.gold) document.getElementById('color-gold').value = colors.gold;
      if (colors.soft) document.getElementById('color-soft').value = colors.soft;
      if (colors.pink) document.getElementById('color-pink').value = colors.pink;
      applyPaletteColors(colors);
    }
  } catch (e) { console.error(e); }
}

function applyPaletteColors(colors) {
  if (!colors) return;
  var root = document.documentElement;
  if (colors.navy) root.style.setProperty('--zeb-navy', colors.navy);
  if (colors.blue) root.style.setProperty('--zeb-blue', colors.blue);
  if (colors.gold) root.style.setProperty('--zeb-gold', colors.gold);
  if (colors.soft) root.style.setProperty('--zeb-soft', colors.soft);
  if (colors.pink) root.style.setProperty('--zeb-pink', colors.pink);
}

async function fetchIngestStatus() {
  try {
    var res = await fetch('/api/profile/ingest-status', { credentials: 'include' });
    if (res.status === 401) return;
    var data = await res.json();
    var statusEl = document.getElementById('ingest-status');
    if (data.canIngest) {
      statusEl.textContent = 'Ingestion available (' + data.ingestCount + '/2 used today)';
      statusEl.style.color = 'var(--color-text-secondary)';
    } else {
      statusEl.textContent = 'Daily limit reached (2/2 used today)';
      statusEl.style.color = '#ef4444';
    }
  } catch (e) { console.error(e); }
}

function init() {
  var savedDark = localStorage.getItem('zebrary-dark');
  state.darkMode = savedDark === '1';
  document.documentElement.classList.toggle('dark', state.darkMode);
  updateDarkIcon();

  fetchProfile();
  fetchAuthors();
  fetchGenres();
  fetchShelves();
  fetchYears();
  fetchPalette();
  fetchIngestStatus();

  document.getElementById('dark-toggle').addEventListener('click', toggleDarkMode);

  document.getElementById('logout-btn').addEventListener('click', async function () {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
    window.location.href = '/';
  });

  document.getElementById('save-account').addEventListener('click', async function () {
    var username = document.getElementById('profile-username').value.trim();
    var email = document.getElementById('profile-email').value.trim();
    try {
      var res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username || undefined, email: email || null }),
        credentials: 'include',
      });
      var data = await res.json();
      if (res.ok) {
        showMessage('account-message', 'Account updated', 'success');
        fetchProfile();
      } else {
        showMessage('account-message', data.error || 'Failed to update', 'error');
      }
    } catch (e) {
      showMessage('account-message', 'Network error', 'error');
    }
  });

  document.getElementById('save-password').addEventListener('click', async function () {
    var current = document.getElementById('password-current').value;
    var newPass = document.getElementById('password-new').value;
    if (!current || !newPass) { showMessage('password-message', 'Fill in both fields', 'error'); return; }
    try {
      var res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
        credentials: 'include',
      });
      var data = await res.json();
      if (res.ok) {
        showMessage('password-message', 'Password updated', 'success');
        document.getElementById('password-current').value = '';
        document.getElementById('password-new').value = '';
      } else {
        showMessage('password-message', data.error || 'Failed', 'error');
      }
    } catch (e) { showMessage('password-message', 'Network error', 'error'); }
  });

  document.getElementById('add-author-btn').addEventListener('click', addAuthor);
  document.getElementById('author-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addAuthor();
  });

  document.getElementById('authors-list').addEventListener('click', function (e) {
    var btn = e.target.closest('.delete-author');
    if (btn) deleteAuthor(parseInt(btn.dataset.authorId));
  });

  document.getElementById('add-whitelist-btn').addEventListener('click', function () { addGenre('whitelist', 'whitelist-input'); });
  document.getElementById('whitelist-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addGenre('whitelist', 'whitelist-input');
  });
  document.getElementById('add-blacklist-btn').addEventListener('click', function () { addGenre('blacklist', 'blacklist-input'); });
  document.getElementById('blacklist-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addGenre('blacklist', 'blacklist-input');
  });

  document.getElementById('whitelist-genres').addEventListener('click', function (e) {
    var span = e.target.closest('.remove-genre');
    if (span) removeGenre(span.dataset.genre, span.dataset.list);
  });
  document.getElementById('blacklist-genres').addEventListener('click', function (e) {
    var span = e.target.closest('.remove-genre');
    if (span) removeGenre(span.dataset.genre, span.dataset.list);
  });

  document.getElementById('save-years').addEventListener('click', async function () {
    var year_min = document.getElementById('year-min').value ? parseInt(document.getElementById('year-min').value) : null;
    var year_max = document.getElementById('year-max').value ? parseInt(document.getElementById('year-max').value) : null;
    try {
      var res = await fetch('/api/profile/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year_min: year_min, year_max: year_max }),
        credentials: 'include',
      });
      if (res.ok) showMessage('years-message', 'Year range saved', 'success');
      else showMessage('years-message', 'Failed to save', 'error');
    } catch (e) { showMessage('years-message', 'Network error', 'error'); }
  });

  document.getElementById('add-shelf-btn').addEventListener('click', addShelf);
  document.getElementById('shelf-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addShelf();
  });

  document.getElementById('shelves-list').addEventListener('click', function (e) {
    var span = e.target.closest('.remove-shelf');
    if (span) removeShelf(span.dataset.shelf);
  });

  document.getElementById('save-palette').addEventListener('click', async function () {
    var colors = {
      navy: document.getElementById('color-navy').value,
      blue: document.getElementById('color-blue').value,
      gold: document.getElementById('color-gold').value,
      soft: document.getElementById('color-soft').value,
      pink: document.getElementById('color-pink').value,
    };
    try {
      var res = await fetch('/api/profile/palette', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colors),
        credentials: 'include',
      });
      if (res.ok) {
        showMessage('palette-message', 'Palette saved', 'success');
        applyPaletteColors(colors);
      } else {
        showMessage('palette-message', 'Failed to save', 'error');
      }
    } catch (e) { showMessage('palette-message', 'Network error', 'error'); }
  });

  document.getElementById('ingest-now-btn').addEventListener('click', async function () {
    var btn = document.getElementById('ingest-now-btn');
    var statusEl = document.getElementById('ingest-status');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Running...';
    lucide.createIcons();
    try {
      var res = await fetch('/api/profile/ingest-now', { method: 'POST', credentials: 'include' });
      var data = await res.json();
      if (res.ok) {
        statusEl.textContent = data.message;
        statusEl.style.color = '#22c55e';
      } else {
        statusEl.textContent = data.error || 'Ingestion failed';
        statusEl.style.color = '#ef4444';
      }
    } catch (e) {
      statusEl.textContent = 'Network error';
      statusEl.style.color = '#ef4444';
    }
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> <span>Ingest Now</span>';
    lucide.createIcons();
    fetchIngestStatus();
  });

  document.getElementById('loading-screen').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
