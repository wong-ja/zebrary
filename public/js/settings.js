var state = {
  isGuest: false,
  authors: [],
  darkMode: false,
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

async function fetchAuthors() {
  try {
    var res = await fetch('/api/settings/authors', { credentials: 'include' });
    var data = await res.json();
    state.authors = data.authors || [];
    renderAuthors();
  } catch (err) {
    console.error('fetchAuthors error:', err);
  }
}

function renderAuthors() {
  var container = document.getElementById('authors-list');
  var loading = document.getElementById('loading-authors');
  loading.classList.add('hidden');
  container.classList.remove('hidden');

  container.innerHTML = state.authors.map(function (author) {
    return '<div class="flex items-center justify-between px-4 py-3 rounded-lg shadow-sm" style="background-color: var(--color-bg-card);">' +
      '<span class="font-medium" style="color: var(--color-text);">' + escapeHtml(author.name) + '</span>' +
      '<button data-author="' + escapeHtml(author.name) + '" role="switch" aria-checked="' + author.tracked + '" aria-label="Toggle tracking for ' + escapeHtml(author.name) + '" class="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-zeb-blue focus:ring-offset-2 dark:focus:ring-offset-gray-900 ' + (author.tracked ? 'bg-zeb-blue' : 'bg-gray-300 dark:bg-gray-600') + '">' +
      '<span class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (author.tracked ? 'translate-x-5' : '') + '"></span>' +
      '</button>' +
      '</div>';
  }).join('');

  lucide.createIcons();
}

async function toggleAuthor(name) {
  try {
    var res = await fetch('/api/settings/authors/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name }),
      credentials: 'include',
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    var data = await res.json();
    if (data.success) {
      for (var i = 0; i < state.authors.length; i++) {
        if (state.authors[i].name === name) {
          state.authors[i].tracked = !state.authors[i].tracked;
          break;
        }
      }
      renderAuthors();
    }
  } catch (err) {
    console.error('toggleAuthor error:', err);
  }
}

function setGuestUI() {
  state.isGuest = true;
  document.getElementById('guest-badge').classList.remove('hidden');
  document.getElementById('auth-buttons').classList.remove('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  document.getElementById('username-display').textContent = '';
  document.getElementById('guest-message').classList.remove('hidden');
  document.getElementById('authors-list').classList.add('hidden');
  document.getElementById('loading-authors').classList.add('hidden');
}

function setAuthUI(username) {
  state.isGuest = false;
  document.getElementById('guest-badge').classList.add('hidden');
  document.getElementById('auth-buttons').classList.add('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('username-display').textContent = username;
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
  window.location.href = '/';
}

function init() {
  var savedDark = localStorage.getItem('zebrary-dark');
  state.darkMode = savedDark === '1';
  document.documentElement.classList.toggle('dark', state.darkMode);
  updateDarkIcon();

  document.getElementById('dark-toggle').addEventListener('click', toggleDarkMode);
  document.getElementById('logout-btn').addEventListener('click', logout);

  fetch('/api/auth/me', { credentials: 'include' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.id) {
        setAuthUI(data.username);
        fetchAuthors();
      } else {
        setGuestUI();
      }
      document.getElementById('loading-screen').classList.add('hidden');
    })
    .catch(function () {
      setGuestUI();
      document.getElementById('loading-screen').classList.add('hidden');
    });

  document.getElementById('authors-list').addEventListener('click', function (e) {
    var btn = e.target.closest('button[role="switch"]');
    if (!btn) return;
    var name = btn.dataset.author;
    toggleAuthor(name);
  });
}

document.addEventListener('DOMContentLoaded', init);
