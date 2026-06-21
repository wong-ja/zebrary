const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const genresPath = path.join(PROJECT_ROOT, 'genres.json');
const genresData = JSON.parse(fs.readFileSync(genresPath, 'utf-8'));

const defaultApprovedWords = (genresData.whitelisted || [])
  .flatMap((g) => g.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
const defaultBlacklistedWords = (genresData.blacklisted || [])
  .flatMap((g) => g.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

function wordMatch(tagWords, refWords) {
  for (const tagWord of tagWords) {
    for (const refWord of refWords) {
      if (tagWord === refWord || tagWord.startsWith(refWord) || refWord.startsWith(tagWord)) {
        return true;
      }
    }
  }
  return false;
}

function tagBook(genreTags, whitelist, blacklist) {
  if (!genreTags || genreTags.length === 0) {
    return 'pending';
  }

  const approvedWords = whitelist
    ? whitelist.flatMap((g) => g.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    : defaultApprovedWords;
  const blacklistedWords = blacklist
    ? blacklist.flatMap((g) => g.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    : defaultBlacklistedWords;

  const tagWords = genreTags
    .flatMap((t) => t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  if (wordMatch(tagWords, blacklistedWords)) {
    return 'blacklisted';
  }
  if (wordMatch(tagWords, approvedWords)) {
    return 'whitelisted';
  }
  return 'pending';
}

module.exports = { tagBook };
