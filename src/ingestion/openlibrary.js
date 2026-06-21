const BASE_URL = process.env.OPEN_LIBRARY_API_BASE || 'https://openlibrary.org';

async function fetchBooksByAuthor(authorName) {
  try {
    const url = `${BASE_URL}/search.json?author=${encodeURIComponent(authorName)}&limit=50`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.warn(`Open Library API returned ${response.status} for "${authorName}"`);
      return [];
    }
    const data = await response.json();
    const docs = data.docs || [];
    return docs.map((doc) => ({
      external_id: doc.key,
      source: 'openlibrary',
      title: doc.title,
      author: (doc.author_name && doc.author_name[0]) || authorName,
      description: null,
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null,
      first_publish_year: doc.first_publish_year || null,
      genre_tags: doc.subject || [],
      source_url: `https://openlibrary.org${doc.key}`,
    }));
  } catch (err) {
    console.warn(`Open Library fetch failed for "${authorName}": ${err.message}`);
    return [];
  }
}

module.exports = { fetchBooksByAuthor };
