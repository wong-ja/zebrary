const fs = require('fs');
const path = require('path');
const pool = require('../db');
const openlibrary = require('./openlibrary');
const googlebooks = require('./googlebooks');
const { tagBook } = require('./tagger');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const AUTHORS_PATH = path.join(PROJECT_ROOT, 'authors.txt');

async function runIngestion(userId) {
  let authors;
  let whitelistedGenres = [];
  let blacklistedGenres = [];
  let yearMin = null;
  let yearMax = null;

  if (userId) {
    authors = (await pool.query(
      'SELECT name FROM user_authors WHERE user_id = $1 ORDER BY name',
      [userId]
    )).rows.map(r => r.name);

    const settingsResult = await pool.query(
      'SELECT whitelisted_genres, blacklisted_genres, year_min, year_max FROM user_settings WHERE user_id = $1',
      [userId]
    );
    if (settingsResult.rows.length > 0) {
      const s = settingsResult.rows[0];
      whitelistedGenres = s.whitelisted_genres || [];
      blacklistedGenres = s.blacklisted_genres || [];
      yearMin = s.year_min;
      yearMax = s.year_max;
    }
  } else {
    authors = (await pool.query('SELECT name FROM author_tracking WHERE tracked = true ORDER BY name'))
      .rows.map(r => r.name);
    if (authors.length === 0) {
      authors = fs
        .readFileSync(AUTHORS_PATH, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }

    const genresData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'genres.json'), 'utf-8'));
    whitelistedGenres = genresData.whitelisted || [];
    blacklistedGenres = genresData.blacklisted || [];
  }

  let totalNew = 0;
  let totalErrors = 0;

  for (const author of authors) {
    const openLibBooks = await openlibrary.fetchBooksByAuthor(author);
    const googleBooks = await googlebooks.fetchBooksByAuthor(author);
    const allBooks = [...openLibBooks, ...googleBooks];

    console.log(`Fetching books for ${author}... found ${allBooks.length} books`);

    for (const book of allBooks) {
      if (yearMin && book.first_publish_year && book.first_publish_year < yearMin) continue;
      if (yearMax && book.first_publish_year && book.first_publish_year > yearMax) continue;

      const status = tagBook(book.genre_tags, whitelistedGenres, blacklistedGenres);
      const genreTags = Array.isArray(book.genre_tags) ? book.genre_tags : [];
      const statusToUse = genreTags.length === 0 ? 'pending' : status;

      try {
        const result = await pool.query(
          `INSERT INTO books (external_id, source, title, author, description, cover_url, first_publish_year, genre_tags, status, source_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
           ON CONFLICT (external_id, source) DO UPDATE SET first_publish_year = EXCLUDED.first_publish_year
           RETURNING id`,
          [
            book.external_id,
            book.source,
            book.title,
            book.author,
            book.description,
            book.cover_url,
            book.first_publish_year || null,
            JSON.stringify(genreTags),
            statusToUse,
            book.source_url,
          ]
        );
        if (result.rows.length > 0) {
          totalNew++;
        }
      } catch (err) {
        console.error(`DB error inserting "${book.title}": ${err.message}`);
        totalErrors++;
      }
    }
  }

  console.log(`Ingestion complete: ${totalNew} new books, 0 updated, ${totalErrors} errors`);
  return { new: totalNew, updated: 0, errors: totalErrors };
}

module.exports = { runIngestion };
