const API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

async function fetchBooksByAuthor(authorName) {
  if (!API_KEY) {
    return [];
  }
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=inauthor:${encodeURIComponent(authorName)}&maxResults=40&key=${API_KEY}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.warn(`Google Books API returned ${response.status} for "${authorName}"`);
      return [];
    }
    const data = await response.json();
    const items = data.items || [];
    return items
      .filter((item) => item.volumeInfo.categories && item.volumeInfo.categories.length > 0)
      .map((item) => {
        const info = item.volumeInfo;
        let coverUrl = null;
        if (info.imageLinks && info.imageLinks.thumbnail) {
          coverUrl = info.imageLinks.thumbnail.replace('http:', 'https:');
        }
        let pubYear = null;
        if (info.publishedDate) {
          const m = info.publishedDate.match(/^(\d{4})/);
          if (m) pubYear = parseInt(m[1], 10);
        }
        return {
          external_id: item.id,
          source: 'google_books',
          title: info.title,
          author: (info.authors && info.authors[0]) || authorName,
          description: info.description || null,
          cover_url: coverUrl,
          first_publish_year: pubYear,
          genre_tags: info.categories || [],
          source_url: info.infoLink || null,
        };
      });
  } catch (err) {
    console.warn(`Google Books fetch failed for "${authorName}": ${err.message}`);
    return [];
  }
}

module.exports = { fetchBooksByAuthor };
