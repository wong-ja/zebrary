-- Users table (auth)
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Books fetched from APIs
CREATE TABLE IF NOT EXISTS books (
    id          SERIAL PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL,
    source      VARCHAR(50) NOT NULL,
    title       VARCHAR(500) NOT NULL,
    author      VARCHAR(255) NOT NULL,
    description TEXT,
    cover_url   VARCHAR(500),
    first_publish_year INTEGER,
    genre_tags  JSONB,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    source_url  VARCHAR(500),
    fetched_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(external_id, source)
);

-- Per-user shelves (join table)
CREATE TABLE IF NOT EXISTS user_shelves (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    shelf       VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- Session store (for connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
    sid         VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess        JSON NOT NULL,
    expire      TIMESTAMP(6) NOT NULL
);

-- Author tracking table
CREATE TABLE IF NOT EXISTS author_tracking (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(255) UNIQUE NOT NULL,
    tracked  BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings (per-user preferences)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    whitelisted_genres JSONB DEFAULT '[]',
    blacklisted_genres JSONB DEFAULT '[]',
    custom_shelves   JSONB DEFAULT '["TBR","Wishlist","Won''t Read"]',
    palette_colors   JSONB DEFAULT '{"navy":"#1d2f6f","blue":"#8390fa","gold":"#fac748","soft":"#f9e9ec","pink":"#f88dad"}',
    year_min     INTEGER DEFAULT NULL,
    year_max     INTEGER DEFAULT NULL,
    ingest_count INTEGER DEFAULT 0,
    ingest_date  DATE DEFAULT NULL
);

-- User-defined authors (per-user tracked authors)
CREATE TABLE IF NOT EXISTS user_authors (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     VARCHAR(255) NOT NULL,
    UNIQUE(user_id, name)
);
