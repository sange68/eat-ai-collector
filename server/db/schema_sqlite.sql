-- SQLite bootstrap (local dev)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    price_twd INTEGER,
    calories_kcal REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    data_line TEXT,
    data_source TEXT,
    data_confidence TEXT,
    source_url TEXT,
    barcode TEXT,
    image_url TEXT,
    derivation_path TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scraper_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    base_url TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id TEXT PRIMARY KEY,
    url TEXT,
    template_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    triggered_by TEXT,
    result_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS scrape_results (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    raw_data TEXT NOT NULL,
    parsed_name TEXT,
    parsed_calories REAL,
    parsed_protein REAL,
    parsed_carbs REAL,
    parsed_fat REAL,
    ai_confidence TEXT,
    ai_notes TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    contributor_email TEXT,
    payload TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'pending',
    reviewer_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
