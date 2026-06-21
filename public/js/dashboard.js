var state = {
  currentTab: 'pending',
  searchQuery: '',
  books: [],
  total: 0,
  page: 1,
  limit: 24,
  totalPages: 0,
  stats: { whitelisted: 0, blacklisted: 0, pending: 0 },
  isGuest: false,
  guestShelves: {},
  authors: [],
  genres: [],
  selectedAuthors: [],
  selectedGenres: [],
  yearMin: '',
  yearMax: '',
  darkMode: false,
  ingestCount: 0,
  canIngest: true,
};

var shelfMode = null;
var path = window.location.pathname;
if (path === '/tbr') shelfMode = 'tbr';
else if (path === '/wish') shelfMode = 'wishlist';

function debounce(fn, delay) {
  var timer;
  return function () {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
  };
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function loadGuestShelves() {
  try {
    var raw = JSON.parse(localStorage.getItem('zebrary_guest_shelves') || '{}');
    state.guestShelves = {};
    Object.keys(raw).forEach(function (key) {
      var val = raw[key];
      if (Array.isArray(val)) {
        state.guestShelves[key] = val;
      } else if (val) {
        state.guestShelves[key] = [val];
      }
    });
  } catch (e) { state.guestShelves = {}; }
}

function saveGuestShelves() {
  try { localStorage.setItem('zebrary_guest_shelves', JSON.stringify(state.guestShelves)); } catch (e) {}
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

async function fetchFilters() {
  try {
    var res = await fetch('/api/books/filters');
    var data = await res.json();
    state.authors = data.authors || [];
    state.genres = data.genres || [];
    renderMultiselects();
  } catch (err) { console.error('fetchFilters error:', err); }
}

function renderMultiselects() {
  renderMultiselect('authors', state.authors, state.selectedAuthors, 'All Authors');
  renderMultiselect('genres', state.genres, state.selectedGenres, 'All Genres');
}

function renderMultiselect(type, options, selected, allLabel) {
  var container = document.querySelector('[data-multiselect="' + type + '"]');
  if (!container) return;
  var label = container.querySelector('.multiselect-label');
  var dropdown = container.querySelector('.multiselect-dropdown');
  var pills = container.querySelector('.multiselect-pills');

  label.textContent = selected.length === 0 ? allLabel : selected.length + ' selected';

  dropdown.innerHTML = options.map(function (opt) {
    var isSelected = selected.indexOf(opt) !== -1;
    return '<div class="multiselect-option flex items-center gap-2 px-3 py-2 cursor-pointer text-sm" data-value="' + escapeHtml(opt) + '" style="' + (isSelected ? 'background-color: rgba(131, 144, 250, 0.15);' : '') + ' color: var(--color-text);">' +
      (isSelected ? '<i data-lucide="check" class="w-4 h-4 text-zeb-blue flex-shrink-0"></i>' : '<span class="w-4 h-4 flex-shrink-0"></span>') +
      '<span>' + escapeHtml(opt) + '</span></div>';
  }).join('');

  pills.innerHTML = selected.map(function (s) {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zeb-blue/10 text-zeb-blue whitespace-nowrap">' + escapeHtml(s) + '<span data-type="' + type + '" data-value="' + escapeHtml(s) + '" class="multiselect-remove cursor-pointer hover:opacity-70" aria-label="Remove ' + escapeHtml(s) + '"><i data-lucide="x" class="w-3 h-3"></i></span></span>';
  }).join('');

  lucide.createIcons();

  dropdown.querySelectorAll('.multiselect-option').forEach(function (optEl) {
    optEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var val = this.dataset.value;
      var arr = type === 'authors' ? state.selectedAuthors : state.selectedGenres;
      var idx = arr.indexOf(val);
      if (idx !== -1) { arr.splice(idx, 1); }
      else { arr.push(val); }
      state.page = 1;
      renderMultiselects();
    });
  });
}

function setupMultiselect(type) {
  var container = document.querySelector('[data-multiselect="' + type + '"]');
  if (!container) return;
  var trigger = container.querySelector('.multiselect-trigger');
  var dropdown = container.querySelector('.multiselect-dropdown');

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = !dropdown.classList.contains('hidden');
    if (isOpen) {
      dropdown.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
      fetchBooks();
    } else {
      closeAllMultiselects();
      dropdown.classList.remove('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
}

function closeAllMultiselects() {
  var anyOpen = false;
  document.querySelectorAll('.multiselect-dropdown').forEach(function (d) {
    if (!d.classList.contains('hidden')) anyOpen = true;
    d.classList.add('hidden');
  });
  document.querySelectorAll('.multiselect-trigger').forEach(function (t) {
    t.setAttribute('aria-expanded', 'false');
  });
  return anyOpen;
}

document.addEventListener('click', function () {
  if (closeAllMultiselects()) fetchBooks();
});

function resetFilters() {
  state.selectedAuthors = [];
  state.selectedGenres = [];
  state.yearMin = '';
  state.yearMax = '';
  state.searchQuery = '';
  state.page = 1;
  document.getElementById('year-min-input').value = '';
  document.getElementById('year-max-input').value = '';
  document.getElementById('search-input').value = '';
  renderMultiselects();
  fetchBooks();
}

async function fetchBooks() {
  try {
    var params = new URLSearchParams();
    if (shelfMode) {
      params.set('shelf', shelfMode);
    } else {
      params.set('status', state.currentTab);
    }
    params.set('page', state.page);
    params.set('limit', state.limit);
    if (state.searchQuery) params.set('search', state.searchQuery);
    if (state.selectedAuthors.length > 0) params.set('author', state.selectedAuthors.join(','));
    if (state.selectedGenres.length > 0) params.set('genre', state.selectedGenres.join(','));
    if (state.yearMin) params.set('year_min', state.yearMin);
    if (state.yearMax) params.set('year_max', state.yearMax);

    var res = await fetch('/api/books?' + params.toString(), { credentials: 'include' });
    if (res.status === 401) { window.location.href = '/'; return; }
    var data = await res.json();
    state.books = (data.books || []).map(function (book) {
      if (state.isGuest) {
        book.user_shelves = state.guestShelves[book.id] || [];
      } else {
        book.user_shelves = book.user_shelves || [];
      }
      return book;
    });
    state.total = data.total || 0;
    state.page = data.page || 1;
    state.totalPages = data.totalPages || 1;
    renderBooks();
    renderPagination();
  } catch (err) { console.error('fetchBooks error:', err); }
}

async function fetchStats() {
  try {
    var res = await fetch('/api/books/stats', { credentials: 'include' });
    if (res.status === 401) { return; }
    var data = await res.json();
    state.stats = data;
    renderStats();
  } catch (err) { console.error('fetchStats error:', err); }
}

async function shelfBook(bookId, shelf) {
  if (state.isGuest) {
    if (!state.guestShelves[bookId]) state.guestShelves[bookId] = [];
    var arr = state.guestShelves[bookId];
    var idx = arr.indexOf(shelf);
    if (idx !== -1) {
      arr.splice(idx, 1);
      if (arr.length === 0) delete state.guestShelves[bookId];
    } else {
      arr.push(shelf);
    }
    saveGuestShelves();
    for (var i = 0; i < state.books.length; i++) {
      if (state.books[i].id === bookId) {
        state.books[i].user_shelves = arr.slice();
        break;
      }
    }
    renderBooks();
    return;
  }
  try {
    var res = await fetch('/api/shelve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: bookId, shelf: shelf }),
      credentials: 'include',
    });
    if (res.status === 401) { window.location.href = '/'; return; }
    await fetchBooks();
  } catch (err) { console.error('shelfBook error:', err); }
}

async function removeShelf(bookId, shelf) {
  if (state.isGuest) {
    if (state.guestShelves[bookId]) {
      var arr = state.guestShelves[bookId];
      var idx = arr.indexOf(shelf);
      if (idx !== -1) {
        arr.splice(idx, 1);
        if (arr.length === 0) delete state.guestShelves[bookId];
      }
    }
    saveGuestShelves();
    for (var i = 0; i < state.books.length; i++) {
      if (state.books[i].id === bookId) {
        state.books[i].user_shelves = (state.guestShelves[bookId] || []).slice();
        break;
      }
    }
    renderBooks();
    return;
  }
  try {
    var res = await fetch('/api/shelve/' + bookId + '/' + shelf, { method: 'DELETE', credentials: 'include' });
    if (res.status === 401) { window.location.href = '/'; return; }
    await fetchBooks();
  } catch (err) { console.error('removeShelf error:', err); }
}

async function blacklistBook(bookId) {
  try {
    var res = await fetch('/api/books/blacklist/' + bookId, { method: 'POST', credentials: 'include' });
    if (res.status === 401) { window.location.href = '/'; return; }
    await fetchBooks();
    await fetchStats();
  } catch (err) { console.error('blacklistBook error:', err); }
}

async function updateBookStatus(bookId, status) {
  try {
    var res = await fetch('/api/books/' + bookId + '/status', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: status }) });
    if (res.status === 401) { window.location.href = '/'; return; }
    await fetchBooks();
    await fetchStats();
  } catch (err) { console.error('updateBookStatus error:', err); }
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
  window.location.href = '/';
}

function renderBooks() {
  var grid = document.getElementById('book-grid');
  var emptyState = document.getElementById('empty-state');

  if (state.books.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    document.getElementById('pagination').classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  var flippedIds = [];
  var cards = grid.querySelectorAll('.card-inner[data-book-id]');
  for (var ci = 0; ci < cards.length; ci++) {
    if (cards[ci].classList.contains('flipped')) {
      flippedIds.push(cards[ci].getAttribute('data-book-id'));
    }
  }

  grid.innerHTML = state.books.map(function (book) {
    var firstLetter = book.title ? book.title.charAt(0).toUpperCase() : '?';

    var coverHtml;
    if (book.cover_url) {
      coverHtml = '<img src="' + escapeHtml(book.cover_url) + '" alt="' + escapeHtml(book.title) + '" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.classList.remove(\'hidden\')">' +
        '<div class="w-full h-full flex flex-col items-center justify-center bg-zeb-soft dark:bg-gray-700 hidden"><span class="text-6xl">&#x1F4D6;</span><span class="text-3xl font-bold mt-2" style="color: var(--color-text-secondary);">' + escapeHtml(firstLetter) + '</span></div>';
    } else {
      coverHtml = '<div class="w-full h-full flex flex-col items-center justify-center bg-zeb-soft dark:bg-gray-700"><span class="text-6xl">&#x1F4D6;</span><span class="text-3xl font-bold mt-2" style="color: var(--color-text-secondary);">' + escapeHtml(firstLetter) + '</span></div>';
    }

    var genres = parseGenres(book.genre_tags);
    var genreHtml = genres.map(function (g) {
      return '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-zeb-blue/10 text-zeb-blue">' + escapeHtml(g) + '</span>';
    }).join(' ');

    var userShelves = book.user_shelves || [];
    var onTbr = userShelves.indexOf('tbr') !== -1;
    var onWish = userShelves.indexOf('wishlist') !== -1;
    var tbrClass = onTbr ? 'bg-zeb-pink text-white' : '';
    var wishClass = onWish ? 'bg-zeb-pink text-white' : '';

    var shelfButtons = '<div class="flex flex-wrap gap-1.5 mt-auto pt-3">';
    if (shelfMode) {
      shelfButtons += '<button data-action="remove" data-book-id="' + book.id + '" data-shelf="' + shelfMode + '" class="flex items-center gap-1 px-2 py-1 text-xs rounded font-medium text-zeb-pink hover:bg-zeb-pink/20 transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Remove</button>';
    } else {
      shelfButtons += '<button data-action="shelf" data-book-id="' + book.id + '" data-shelf="tbr" class="flex items-center gap-1 px-2 py-1 text-xs rounded font-medium transition-colors ' + (tbrClass || 'bg-zeb-soft dark:bg-gray-700 text-zeb-dark dark:text-zeb-light hover:bg-zeb-pink/30') + '"><i data-lucide="bookmark" class="w-3.5 h-3.5"></i>TBR</button>' +
        '<button data-action="shelf" data-book-id="' + book.id + '" data-shelf="wishlist" class="flex items-center gap-1 px-2 py-1 text-xs rounded font-medium transition-colors ' + (wishClass || 'bg-zeb-soft dark:bg-gray-700 text-zeb-dark dark:text-zeb-light hover:bg-zeb-pink/30') + '"><i data-lucide="heart" class="w-3.5 h-3.5"></i>Wish</button>' +
        '<button data-action="blacklist" data-book-id="' + book.id + '" class="flex items-center gap-1 px-2 py-1 text-xs rounded font-medium bg-zeb-soft dark:bg-gray-700 text-zeb-dark dark:text-zeb-light hover:bg-red-200 dark:hover:bg-red-900 transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Remove</button>';
    }
    shelfButtons += '</div>';

    var yearHtml = book.first_publish_year ? '<p class="text-xs mt-1" style="color: var(--color-text-secondary);">Published: ' + book.first_publish_year + '</p>' : '';
    var desc = book.description ? book.description.substring(0, 120) + (book.description.length > 120 ? '...' : '') : '';
    var descHtml = desc ? '<p class="text-xs mt-2 leading-relaxed line-clamp-3 overflow-hidden" style="color: var(--color-text-secondary);">' + escapeHtml(desc) + '</p>' : '';

    return '<div class="card-container">' +
      '<div class="card-inner rounded-xl shadow" data-book-id="' + book.id + '" style="background-color: var(--color-bg-card);">' +
      '<div class="card-front rounded-xl">' +
      coverHtml +
      '</div>' +
      '<div class="card-back rounded-xl p-5 flex flex-col" style="background-color: var(--color-bg-card);">' +
      '<h3 class="font-bold text-base truncate" title="' + escapeHtml(book.title) + '" style="color: var(--color-text);">' + escapeHtml(book.title) + '</h3>' +
      '<p class="text-sm mt-1 truncate" style="color: var(--color-text-secondary);" title="' + escapeHtml(book.author) + '">' + escapeHtml(book.author) + '</p>' +
      yearHtml +
      (genreHtml ? '<div class="flex flex-wrap gap-1.5 mt-2">' + genreHtml + '</div>' : '') +
      descHtml +
      '<div class="flex gap-1.5 mt-2">' +
'<button data-action="status" data-book-id="' + book.id + '" data-status="pending" class="flex-1 px-1.5 py-0.5 text-xs rounded font-medium transition-colors ' + (book.status === 'pending' ? 'bg-zeb-gold/30 text-zeb-dark dark:text-zeb-light ring-2 ring-zeb-gold/50' : 'bg-zeb-soft dark:bg-gray-700 text-zeb-dark dark:text-zeb-light hover:bg-zeb-gold/20') + '">Pending</button>' +
'<button data-action="status" data-book-id="' + book.id + '" data-status="whitelisted" class="flex-1 px-1.5 py-0.5 text-xs rounded font-medium transition-colors ' + (book.status === 'whitelisted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ring-2 ring-green-500/50' : 'bg-zeb-soft dark:bg-gray-700 text-zeb-dark dark:text-zeb-light hover:bg-green-200 dark:hover:bg-green-900') + '">Whitelist</button>' +
'<button data-action="status" data-book-id="' + book.id + '" data-status="blacklisted" class="flex-1 px-1.5 py-0.5 text-xs rounded font-medium transition-colors ' + (book.status === 'blacklisted' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 ring-2 ring-red-500/50' : 'bg-zeb-soft dark:bg-gray-700 text-zeb-dark dark:text-zeb-light hover:bg-red-200 dark:hover:bg-red-900') + '">Blacklist</button>' +
'</div>' +
      shelfButtons +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  for (var fi = 0; fi < flippedIds.length; fi++) {
    var restored = grid.querySelector('.card-inner[data-book-id="' + flippedIds[fi] + '"]');
    if (restored) restored.classList.add('flipped');
  }

  lucide.createIcons();
}

function parseGenres(tags) {
  if (!tags) return [];
  if (typeof tags === 'string') {
    try { return JSON.parse(tags); } catch (e) { return []; }
  }
  if (Array.isArray(tags)) return tags;
  return [];
}

function renderPagination() {
  var pagination = document.getElementById('pagination');
  var pageInfo = document.getElementById('page-info');
  var prevBtn = document.getElementById('prev-page');
  var nextBtn = document.getElementById('next-page');

  if (state.totalPages <= 1) {
    pagination.classList.add('hidden');
    return;
  }

  pagination.classList.remove('hidden');
  pageInfo.textContent = 'Page ' + state.page + ' of ' + state.totalPages;
  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= state.totalPages;
}

function renderStats() {
  document.getElementById('count-pending').textContent = '(' + state.stats.pending + ')';
  document.getElementById('count-whitelisted').textContent = '(' + state.stats.whitelisted + ')';
  document.getElementById('count-blacklisted').textContent = '(' + state.stats.blacklisted + ')';
}

function switchTab(status) {
  state.currentTab = status;
  state.searchQuery = '';
  state.page = 1;
  document.getElementById('search-input').value = '';
  window.location.hash = status;

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    var ts = btn.dataset.status;
    btn.className = 'tab-btn px-4 py-2 rounded-full text-sm font-medium transition-colors';
    if (ts === status) {
      btn.classList.add('bg-zeb-navy', 'text-white', 'dark:bg-zeb-blue', 'dark:text-white');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-zeb-dark', 'dark:text-zeb-light', 'border', 'border-gray-200', 'dark:border-gray-600');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  fetchBooks();
}

function setGuestUI() {
  state.isGuest = true;
  loadGuestShelves();
  document.getElementById('guest-badge').classList.remove('hidden');
  document.getElementById('guest-banner').classList.remove('hidden');
  document.getElementById('auth-buttons').classList.remove('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  document.getElementById('username-display').textContent = '';
}

function setAuthUI(username) {
  state.isGuest = false;
  document.getElementById('guest-badge').classList.add('hidden');
  document.getElementById('guest-banner').classList.add('hidden');
  document.getElementById('auth-buttons').classList.add('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('username-display').textContent = username;
  document.getElementById('ingest-now-btn').classList.remove('hidden');
  fetchIngestStatus();
}

function updateIngestButton() {
  var btn = document.getElementById('ingest-now-btn');
  if (!btn) return;
  btn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> <span>Ingest Now (' + state.ingestCount + '/2)</span>';
  btn.disabled = !state.canIngest;
  if (!state.canIngest) {
    btn.classList.add('opacity-60', 'cursor-not-allowed');
  } else {
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
  }
  lucide.createIcons();
}

async function fetchIngestStatus() {
  try {
    var res = await fetch('/api/profile/ingest-status', { credentials: 'include' });
    var data = await res.json();
    state.ingestCount = data.ingestCount || 0;
    state.canIngest = data.canIngest;
    updateIngestButton();
  } catch (e) {
    console.error('fetchIngestStatus error:', e);
  }
}

function openModal() {
  document.getElementById('search-modal').classList.remove('hidden');
  document.getElementById('modal-search-input').value = '';
  document.getElementById('modal-results').innerHTML = '';
  document.getElementById('modal-empty').classList.remove('hidden');
  document.getElementById('modal-loading').classList.add('hidden');
  document.getElementById('modal-search-input').focus();
}

function closeModal() {
  document.getElementById('search-modal').classList.add('hidden');
}

async function searchExternal() {
  var q = document.getElementById('modal-search-input').value.trim();
  if (!q) return;

  var resultsDiv = document.getElementById('modal-results');
  var emptyDiv = document.getElementById('modal-empty');
  var loadingDiv = document.getElementById('modal-loading');

  emptyDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '';

  try {
    var res = await fetch('/api/search-external?q=' + encodeURIComponent(q));
    var data = await res.json();
    var results = data.results || [];
    loadingDiv.classList.add('hidden');

    if (results.length === 0) {
      emptyDiv.classList.remove('hidden');
      emptyDiv.innerHTML = '<p>No results found for "' + escapeHtml(q) + '"</p>';
      return;
    }

    resultsDiv.innerHTML = results.map(function (book) {
      var cover = book.cover_url
        ? '<img src="' + escapeHtml(book.cover_url) + '" alt="' + escapeHtml(book.title) + '" class="w-full h-40 object-cover rounded-t-lg" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.classList.remove(\'hidden\')"><div class="w-full h-40 flex items-center justify-center text-4xl bg-zeb-soft dark:bg-gray-700 rounded-t-lg hidden">&#x1F4D6;</div>'
        : '<div class="w-full h-40 flex items-center justify-center text-4xl bg-zeb-soft dark:bg-gray-700 rounded-t-lg">&#x1F4D6;</div>';

      return '<div class="rounded-lg shadow overflow-hidden" style="background-color: var(--color-bg);">' +
        cover +
        '<div class="p-3">' +
        '<h4 class="font-semibold text-sm truncate" style="color: var(--color-text);">' + escapeHtml(book.title) + '</h4>' +
        '<p class="text-xs mt-1" style="color: var(--color-text-secondary);">' + escapeHtml(book.author) + '</p>' +
        '<button data-external-add=\'' + JSON.stringify(book).replace(/'/g, '&#39;') + '\' class="mt-2 w-full bg-zeb-navy dark:bg-zeb-blue hover:opacity-90 text-white py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 add-external-btn"><i data-lucide="plus" class="w-3 h-3"></i> Add to Zebrary</button>' +
        '</div></div>';
    }).join('');

    lucide.createIcons();
  } catch (err) {
    loadingDiv.classList.add('hidden');
    emptyDiv.classList.remove('hidden');
    emptyDiv.innerHTML = '<p>Search failed. Please try again.</p>';
    console.error('searchExternal error:', err);
  }
}

async function addExternalBook(bookData) {
  if (state.isGuest) {
    alert('Please sign in to add books to Zebrary.');
    return;
  }

  try {
    var res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_id: bookData.external_id,
        source: bookData.source,
        title: bookData.title,
        author: bookData.author,
        cover_url: bookData.cover_url,
        genre_tags: bookData.genre_tags,
        source_url: bookData.source_url,
        first_publish_year: bookData.first_publish_year,
        description: bookData.description,
      }),
      credentials: 'include',
    });
    if (res.status === 401) { window.location.href = '/'; return; }
    if (!res.ok) { alert('Failed to add book'); return; }
    closeModal();
    fetchBooks();
    fetchStats();
  } catch (err) {
    console.error('addExternalBook error:', err);
    alert('Failed to add book');
  }
}

function init() {
  var savedDark = localStorage.getItem('zebrary-dark');
  state.darkMode = savedDark === '1';
  document.documentElement.classList.toggle('dark', state.darkMode);
  updateDarkIcon();

  if (shelfMode) {
    document.getElementById('filter-tabs').classList.add('hidden');
    document.querySelector('.flex.items-center.gap-2 .text-sm.font-semibold').textContent = shelfMode === 'tbr' ? 'TBR Books' : 'Wishlist Books';
  } else {
    var hash = window.location.hash.replace('#', '');
    if (['pending', 'whitelisted', 'blacklisted'].indexOf(hash) !== -1) {
      state.currentTab = hash;
    }
  }

  fetchFilters();
  setupMultiselect('authors');
  setupMultiselect('genres');

  document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);

  fetch('/api/auth/me', { credentials: 'include' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.id) {
        setAuthUI(data.username);
      } else {
        setGuestUI();
      }
      switchTab(state.currentTab);
      fetchStats();

      document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { switchTab(btn.dataset.status); });
      });

      var searchInput = document.getElementById('search-input');
      var debouncedSearch = debounce(function () {
        state.searchQuery = searchInput.value.trim();
        state.page = 1;
        fetchBooks();
      }, 300);
      searchInput.addEventListener('input', debouncedSearch);

      document.getElementById('logout-btn').addEventListener('click', logout);
      document.getElementById('dark-toggle').addEventListener('click', toggleDarkMode);

      var grid = document.getElementById('book-grid');
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (btn) {
          var bookId = parseInt(btn.dataset.bookId);
          var action = btn.dataset.action;
          if (action === 'shelf') { shelfBook(bookId, btn.dataset.shelf); }
          else if (action === 'remove') { removeShelf(bookId, btn.dataset.shelf); }
          else if (action === 'blacklist') { blacklistBook(bookId); }
          else if (action === 'status') { updateBookStatus(bookId, btn.dataset.status); }
          return;
        }
        var cardInner = e.target.closest('.card-inner');
        if (cardInner) cardInner.classList.toggle('flipped');
      });

      document.getElementById('prev-page').addEventListener('click', function () {
        if (state.page > 1) { state.page--; fetchBooks(); }
      });

      document.getElementById('next-page').addEventListener('click', function () {
        if (state.page < state.totalPages) { state.page++; fetchBooks(); }
      });

      document.getElementById('search-add-btn').addEventListener('click', openModal);
      document.getElementById('modal-close').addEventListener('click', closeModal);

      var ingestBtn = document.getElementById('ingest-now-btn');
      if (ingestBtn) {
        ingestBtn.addEventListener('click', async function () {
          if (!state.canIngest) return;
          ingestBtn.disabled = true;
          ingestBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Running...';
          lucide.createIcons();
          try {
            var res = await fetch('/api/profile/ingest-now', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if (res.ok) { alert(data.message); }
            else { alert(data.error || 'Ingestion failed'); }
          } catch (e) { alert('Network error'); }
          fetchIngestStatus();
          fetchBooks();
          fetchStats();
        });
      }
      document.getElementById('search-modal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
      });
      document.getElementById('modal-search-btn').addEventListener('click', searchExternal);
      document.getElementById('modal-search-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') searchExternal();
      });

      document.getElementById('modal-results').addEventListener('click', function (e) {
        var btn = e.target.closest('.add-external-btn');
        if (!btn) return;
        try {
          var bookData = JSON.parse(btn.dataset.externalAdd);
          addExternalBook(bookData);
        } catch (err) { console.error('Error parsing book data:', err); }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
      });

      var yearMinInput = document.getElementById('year-min-input');
      var yearMaxInput = document.getElementById('year-max-input');
      function applyYearFilter() {
        state.yearMin = yearMinInput.value.trim();
        state.yearMax = yearMaxInput.value.trim();
        state.page = 1;
        fetchBooks();
      }
      var debouncedYear = debounce(applyYearFilter, 400);
      yearMinInput.addEventListener('input', debouncedYear);
      yearMaxInput.addEventListener('input', debouncedYear);

      document.querySelectorAll('.multiselect-pills').forEach(function (pillsContainer) {
        pillsContainer.addEventListener('click', function (e) {
          var removeBtn = e.target.closest('.multiselect-remove');
          if (!removeBtn) return;
          var type = removeBtn.dataset.type;
          var value = removeBtn.dataset.value;
          var arr = type === 'authors' ? state.selectedAuthors : state.selectedGenres;
          var idx = arr.indexOf(value);
          if (idx !== -1) arr.splice(idx, 1);
          state.page = 1;
          renderMultiselects();
          fetchBooks();
        });
      });

      document.getElementById('loading-screen').classList.add('hidden');
    })
    .catch(function () {
      setGuestUI();
      switchTab(state.currentTab);
      fetchStats();
      document.getElementById('loading-screen').classList.add('hidden');
    });
}

document.addEventListener('DOMContentLoaded', init);
