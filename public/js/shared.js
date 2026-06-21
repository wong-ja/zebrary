var PLACEHOLDER_COLORS = [
  'bg-red-200', 'bg-blue-200', 'bg-green-200', 'bg-yellow-200',
  'bg-purple-200', 'bg-pink-200', 'bg-indigo-200', 'bg-teal-200',
  'bg-orange-200', 'bg-cyan-200',
];

var SHELF_LABELS = { tbr: 'TBR', wishlist: 'Wishlist', wont_read: 'Won\'t Read' };

var STATUS_COLORS = {
  whitelisted: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  blacklisted: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  pending: 'bg-zeb-gold/20 text-zeb-dark dark:text-zeb-light',
};

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getUserIdFromPath() {
  var match = window.location.pathname.match(/\/shared\/(\d+)/);
  return match ? match[1] : null;
}

function pickColor(str) {
  var index = (str ? str.charCodeAt(0) : 0) % PLACEHOLDER_COLORS.length;
  return PLACEHOLDER_COLORS[index];
}

async function fetchSharedBooks(userId) {
  try {
    var res = await fetch('/api/shared/' + userId);
    return await res.json();
  } catch (err) {
    console.error('fetchSharedBooks error:', err);
    return null;
  }
}

function renderBooks(data) {
  var grid = document.getElementById('book-grid');
  var message = document.getElementById('message');
  var messageText = document.getElementById('message-text');
  var subtitle = document.getElementById('subtitle');

  if (!data || data.username === null) {
    document.getElementById('loading-screen').classList.add('hidden');
    grid.classList.add('hidden');
    message.classList.remove('hidden');
    messageText.textContent = 'User not found';
    subtitle.textContent = 'Shared books';
    return;
  }

  document.getElementById('loading-screen').classList.add('hidden');
  subtitle.textContent = 'Shared books by ' + data.username;

  if (data.books.length === 0) {
    grid.classList.add('hidden');
    message.classList.remove('hidden');
    messageText.textContent = 'No books shared yet';
    return;
  }

  grid.classList.remove('hidden');
  message.classList.add('hidden');

  grid.innerHTML = data.books.map(function (book) {
    var firstLetter = book.title ? book.title.charAt(0).toUpperCase() : '?';
    var colorClass = pickColor(book.title);
    var colorClassFront = pickColor(book.title + '-front');
    var genres = parseGenres(book.genre_tags);

    var coverHtml;
    if (book.cover_url) {
      coverHtml = '<img src="' + escapeHtml(book.cover_url) + '" alt="' + escapeHtml(book.title) + '" class="w-full h-full object-cover cursor-pointer" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.classList.remove(\'hidden\')">' +
        '<div class="w-full h-full flex flex-col items-center justify-center ' + colorClassFront + ' hidden"><span class="text-6xl">&#x1F4D6;</span><span class="text-3xl font-bold text-gray-700 mt-2">' + escapeHtml(firstLetter) + '</span></div>';
    } else {
      coverHtml = '<div class="w-full h-full flex flex-col items-center justify-center ' + colorClass + '"><span class="text-6xl">&#x1F4D6;</span><span class="text-3xl font-bold text-gray-700 mt-2">' + escapeHtml(firstLetter) + '</span></div>';
    }

    var genreHtml = genres.map(function (g) {
      return '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-zeb-blue/10 text-zeb-blue">' + escapeHtml(g) + '</span>';
    }).join(' ');

    var statusClass = STATUS_COLORS[book.status] || 'bg-gray-100 text-gray-800';
    var desc = book.description ? book.description.substring(0, 80) + (book.description.length > 80 ? '...' : '') : '';
    var descHtml = desc ? '<p class="text-xs mt-2 leading-relaxed line-clamp-2 overflow-hidden" style="color: var(--color-text-secondary);">' + escapeHtml(desc) + '</p>' : '';

    return '<div class="card-container">' +
      '<div class="card-inner rounded-lg shadow" style="background-color: var(--color-bg-card);">' +
      '<div class="card-front rounded-lg">' +
      coverHtml +
      '</div>' +
      '<div class="card-back rounded-lg p-5 flex flex-col justify-between" style="background-color: var(--color-bg-card);">' +
      '<div>' +
      '<h3 class="font-bold text-base truncate" title="' + escapeHtml(book.title) + '" style="color: var(--color-text);">' + escapeHtml(book.title) + '</h3>' +
      '<p class="text-sm mt-1 truncate" style="color: var(--color-text-secondary);" title="' + escapeHtml(book.author) + '">' + escapeHtml(book.author) + '</p>' +
      (genreHtml ? '<div class="flex flex-wrap gap-1.5 mt-2">' + genreHtml + '</div>' : '') +
      descHtml +
      '<span class="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ' + statusClass + '">' + book.status + '</span>' +
      '</div>' +
      '<button class="details-btn mt-4 w-full bg-zeb-navy dark:bg-zeb-blue hover:opacity-90 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors" data-book-id="' + book.id + '">See Details</button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  attachCardClicks();
}

function parseGenres(tags) {
  if (!tags) return [];
  if (typeof tags === 'string') {
    try { return JSON.parse(tags); } catch (e) { return []; }
  }
  if (Array.isArray(tags)) return tags;
  return [];
}

function attachCardClicks() {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.querySelectorAll('.card-inner').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.details-btn')) return;
        this.classList.toggle('flipped');
      });
    });
  }
}

function openModal(book) {
  var modal = document.getElementById('modal');
  var coverImg = document.getElementById('modal-cover');
  var coverPlaceholder = document.getElementById('modal-cover-placeholder');
  var title = document.getElementById('modal-title');
  var author = document.getElementById('modal-author');
  var description = document.getElementById('modal-description');
  var genres = document.getElementById('modal-genres');
  var status = document.getElementById('modal-status');
  var shelf = document.getElementById('modal-shelf');
  var source = document.getElementById('modal-source');

  var firstLetter = book.title ? book.title.charAt(0).toUpperCase() : '?';

  if (book.cover_url) {
    coverImg.src = book.cover_url;
    coverImg.alt = book.title || '';
    coverImg.classList.remove('hidden');
    coverPlaceholder.classList.add('hidden');
    coverImg.onerror = function () {
      coverImg.classList.add('hidden');
      coverPlaceholder.className = 'w-full h-64 rounded mb-4 flex items-center justify-center text-6xl ' + pickColor(book.title);
      coverPlaceholder.innerHTML = '<span>&#x1F4D6;</span><span class="text-3xl font-bold text-gray-700 ml-3">' + escapeHtml(firstLetter) + '</span>';
      coverPlaceholder.classList.remove('hidden');
    };
  } else {
    coverImg.classList.add('hidden');
    coverPlaceholder.className = 'w-full h-64 rounded mb-4 flex items-center justify-center text-6xl ' + pickColor(book.title);
    coverPlaceholder.innerHTML = '<span>&#x1F4D6;</span><span class="text-3xl font-bold text-gray-700 ml-3">' + escapeHtml(firstLetter) + '</span>';
    coverPlaceholder.classList.remove('hidden');
  }

  title.textContent = book.title || '';
  author.textContent = book.author || '';
  description.textContent = book.description || '';
  description.classList.toggle('hidden', !book.description);

  var genreList = parseGenres(book.genre_tags);
  genres.innerHTML = genreList.map(function (g) {
    return '<span class="px-3 py-1 rounded-full text-xs font-medium bg-zeb-blue/10 text-zeb-blue">' + escapeHtml(g) + '</span>';
  }).join('');
  genres.classList.toggle('hidden', genreList.length === 0);

  var statusClass = STATUS_COLORS[book.status] || 'bg-gray-100 text-gray-800 dark:text-gray-200';
  status.innerHTML = '<span class="inline-block px-3 py-1 rounded-full text-sm font-medium ' + statusClass + '">' + escapeHtml(book.status) + '</span>';

  var shelfLabel = SHELF_LABELS[book.shelf] || book.shelf;
  shelf.textContent = 'Shelf: ' + shelfLabel;
  shelf.classList.remove('hidden');
  shelf.className = 'mt-2 text-sm font-medium text-zeb-pink';

  if (book.source_url) {
    source.href = book.source_url;
    source.classList.remove('hidden');
    source.className = 'inline-block mt-4 text-zeb-blue hover:text-zeb-navy dark:hover:text-white underline font-medium';
  } else {
    source.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function init() {
  var userId = getUserIdFromPath();
  if (!userId) {
    document.getElementById('message-text').textContent = 'Invalid URL';
    document.getElementById('message').classList.remove('hidden');
    document.getElementById('book-grid').classList.add('hidden');
    return;
  }

  fetchSharedBooks(userId).then(function (data) {
    renderBooks(data);
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.details-btn');
    if (!btn) return;
    fetchSharedBooks(userId).then(function (data) {
      if (data && data.books) {
        var bookId = parseInt(btn.dataset.bookId);
        var book = data.books.find(function (b) { return b.id === bookId; });
        if (book) openModal(book);
      }
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('modal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
