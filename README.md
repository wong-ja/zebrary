# Zebrary

A **personal book discovery and shelving app** that periodically fetches recently-published books for any authors you choose, auto-tags them against your own approved/blacklisted genre rules, and lets you organize them on custom shelves — TBR, Wishlist, or Won't Read. Configuration is entirely data-driven: edit `authors.txt` and `genres.json` to track whatever authors and genres matter to you.

Built for deployment on Vercel with a Neon Postgres backend.

---

## Architecture

```
Browser  ←→  Express (Vercel Serverless)  ←→  Neon Postgres
                  ↕
           Open Library API (primary)
           Google Books API (secondary)
```

The app follows a monolithic serverless architecture: a single Express application is exported as a Vercel serverless function (`api/index.js`) that handles both API routes and static file serving. Session state is stored in Postgres (via `connect-pg-simple`), making it compatible with serverless's stateless nature.

### Data flow

1. **Ingestion** — A cron job (node-cron, every 6h) or manual `POST /api/ingest/run` trigger fetches books from the Open Library search API (primary) and optionally Google Books (secondary). Each book is mapped to a normalized shape and upserted into the `books` table.
2. **Tagging** — Each book's genre/subject tags are cross-referenced against `genres.json`. If any tag matches a blacklisted genre → `blacklisted`; if any matches an approved genre → `approved`; otherwise → `pending`.
3. **Shelving** — Authenticated users can place books on personal shelves (TBR, Wishlist, Won't Read) via the dashboard. Shelf state is stored per user in the `user_shelves` join table.
4. **Sharing** — The unauthenticated `/shared/:userId` route renders a public grid of flip-cards showing that user's shelved books.

---

## Tech Stack & Services

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 22 |
| **Framework** | Express 5 |
| **Database** | Neon Postgres (serverless) via `@neondatabase/serverless` |
| **Auth** | bcryptjs + express-session + connect-pg-simple |
| **Styling** | Tailwind CSS 3 (CLI build, not CDN) |
| **Scheduling** | node-cron |
| **Data sources** | Open Library API (primary), Google Books API (optional secondary) |

### Why these choices

- **Neon Postgres** — Serverless-friendly Postgres with connection pooling; `@neondatabase/serverless` works natively with Vercel's Node.js runtime.
- **Tailwind CLI** — Build-step compilation produces a minimal production CSS file (no runtime CDN dependency).
- **connect-pg-simple** — Session store backed by Postgres so sessions survive serverless cold starts and scale across function instances.
- **Open Library** — Free, no API key required, ToS-compliant. Goodreads has no public API and is explicitly not used.

---

## Features

### Book Discovery
- Fetches books for any authors you list in `authors.txt` — add, remove, or replace freely (no code changes needed)
- Dual-source ingestion: Open Library (primary) + Google Books (optional secondary)
- Scheduled auto-fetching every 6 hours + manual trigger
- Deduplication via `ON CONFLICT DO NOTHING` on `(external_id, source)`

### Genre Auto-Tagging
- Define your own approved and blacklisted genres in `genres.json` — any genre tags you add are immediately used on the next ingestion run
- Word-level matching (e.g., `sci-fi` matches `Science fiction`, `Comics` matches `Comics & Graphic Novels`)
- Tagged as: **Approved**, **Blacklisted**, or **Pending** (manual review)

### Dashboard (authenticated)
- Filter tabs: Pending / Approved / Blacklisted with live counts
- Debounced live search across title, author, and description
- Shelving: TBR, Wishlist, Won't Read, Remove
- Responsive grid layout (1→2→4 columns)

### Public Share Page (`/shared/:userId`)
- CSS 3D flip-cards (hover to flip, tap on touch devices)
- Cover image with fallback placeholder
- Genre pills, status badge, shelf label
- Details modal with full metadata + link to source page
- No authentication required

### Guest Mode (No Account Required)
- Landing page with "Browse as Guest" — no registration needed to explore
- Full browsing, filtering, and searching work without authentication
- Shelving actions stored in `localStorage` (persists in-browser)
- Guest banner and badge clearly indicate local-only mode
- One-click "Sign In" from the dashboard to save shelves server-side

### Authentication
- Username/password registration and login
- bcrypt password hashing (10 rounds)
- Postgres-backed sessions
- Protected dashboard routes with `requireAuth` middleware

---

## Project Structure

```
book-tracker/
├── api/
│   └── index.js              # Vercel serverless entry point
├── public/
│   ├── css/
│   │   ├── input.css          # Tailwind source
│   │   └── output.css         # Built Tailwind (gitignored)
│   ├── js/
│   │   ├── dashboard.js       # Dashboard frontend logic
│   │   ├── login.js           # Login/register frontend
│   │   └── shared.js          # Public share page frontend
│   ├── logo.png               # App logo
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   └── android-chrome-512x512.png
├── src/
│   ├── db.js                  # Neon Pool connection
│   ├── schema.sql             # Full DDL
│   ├── apply-schema.js        # Apply schema to DB
│   ├── index.js               # Express app
│   ├── routes/
│   │   ├── auth.js            # Register, login, logout, /me
│   │   ├── dashboard.js       # Books list, shelve, stats API
│   │   ├── ingestion.js       # Ingestion trigger & status
│   │   └── shared.js          # Shared books API
│   ├── middleware/
│   │   └── auth.js            # requireAuth, optionalAuth
│   └── ingestion/
│       ├── openlibrary.js     # Open Library API fetcher
│       ├── googlebooks.js     # Google Books API fetcher
│       ├── tagger.js          # Genre auto-tagger
│       ├── runner.js          # Ingestion orchestrator
│       └── cron.js            # node-cron scheduler
├── views/
│   ├── landing.html           # Landing page (guest entry point)
│   ├── login.html             # Login/register page
│   ├── dashboard.html         # Dashboard SPA
│   └── shared.html            # Public share page
├── authors.txt                # Author list
├── genres.json                # Approved/blacklisted genres
├── .env.example               # Environment variable template
├── CONTRACT.md                # Schema, env vars, API shapes
├── DEPLOY.md                  # Deployment guide
├── PROGRESS.md                # Build history
├── vercel.json                # Vercel configuration
├── tailwind.config.js
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon Postgres](https://neon.tech) database
- A [Vercel](https://vercel.com) account (for deployment)

### Local Development

```bash
# 1. Clone and install
npm install

# 2. Copy environment variables
cp .env.example .env
# Edit .env: fill in DATABASE_URL and SESSION_SECRET

# 3. Apply database schema
npm run apply-schema

# 4. Start dev server
npm run dev
```

The server starts at `http://localhost:3000`. Tailwind watches for changes and rebuilds CSS automatically.

The app immediately works in **guest mode** — visit the landing page, click "Browse as Guest", and explore books without creating an account. Shelves are stored in your browser and persist across sessions.

### Seed Data

Before ingesting, customize `authors.txt` with the authors you want to track and `genres.json` with your own approval rules. Then populate the database:

```bash
curl -X POST http://localhost:3000/api/ingest/run
```

This fetches books for every author in `authors.txt` from Open Library (and Google Books if `GOOGLE_BOOKS_API_KEY` is set). Re-run any time you change either file — new books are added, existing ones are left untouched.

---

## API Reference

### Pages

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Landing page (or redirect to /dashboard if authenticated) |
| GET | `/dashboard` | No | Dashboard (guest mode if not authenticated) |
| GET | `/login` | No | Login/register page (or redirect to /dashboard if authenticated) |
| GET | `/shared/:userId` | No | Public shared books page |

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account `{ username, password }` |
| POST | `/api/auth/login` | No | Login `{ username, password }` |
| POST | `/api/auth/logout` | No | Destroy session |
| GET | `/api/auth/me` | No | Current user info (returns `{ id: null, username: null }` for guests) |

### Books

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/books?status=&search=` | No | List books filtered by status and search query (guest-friendly) |
| GET | `/api/books/stats` | No | Count of books per status (guest-friendly) |

### Shelving

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/shelve` | Yes | Shelve a book `{ bookId, shelf }` (tbr/wishlist/wont_read) — guests use localStorage |
| DELETE | `/api/shelve/:bookId` | Yes | Remove book from shelf — guests use localStorage |

### Ingestion

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ingest/run` | No | Trigger book ingestion on-demand |
| GET | `/api/ingest/status` | No | Ingestion status |

### Public

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/shared/:userId` | No | Get a user's shelved books |
| GET | `/shared/:userId` | No | Public share page (HTML) |

### Misc

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Health check |

---

## Deployment

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.

Quick summary:
1. Push to GitHub
2. Import repo in Vercel
3. Set environment variables (`DATABASE_URL`, `SESSION_SECRET`) in Vercel dashboard
4. Deploy — Vercel uses `vercel.json` to route all traffic through the Express serverless function
5. After deploy, trigger ingestion via `POST /api/ingest/run`
6. Register a user and start shelving books

---

## Configuration

Both files live at the project root and are read at ingestion time — no server restart or code change needed. Edit them freely to match your own interests.

### `genres.json`

```json
{
  "approved": ["Fantasy", "Sci-Fi", "Romance", "Thriller"],
  "blacklisted": ["Comics", "Self-Help", "Business"]
}
```

- **`approved`** — Genre tags matching any of these words mark a book as *Approved*. Use your preferred genres.
- **`blacklisted`** — Genre tags matching any of these words mark a book as *Blacklisted* (overrides approved). Use genres you want to exclude.
- Books matching neither list land as *Pending* for manual review.
- Matching is case-insensitive and word-level (e.g. `sci-fi` matches both `Sci‑Fi` and `Science fiction`; `comics` matches both `Comics` and `Comics & Graphic Novels`).

### `authors.txt`

One author name per line. Ingestion fetches up to 50 books per author from Open Library. Replace the defaults with any authors you care about:

```
N.K. Jemisin
Ted Chiang
Octavia Butler
```

Add as many as you like — the ingestion runner loops through every line and merges results from all authors.

---

## License

MIT
