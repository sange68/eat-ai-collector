-- Eat AI Collector - initial schema
-- Run in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'contributor')),
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT CHECK (category IN ('main', 'side', 'drink', 'snack')),
    price_twd INTEGER,
    calories_kcal NUMERIC(10, 2),
    protein_g NUMERIC(10, 2),
    carbs_g NUMERIC(10, 2),
    fat_g NUMERIC(10, 2),
    data_line TEXT CHECK (data_line IN ('convenience_chain', 'street_food')),
    data_source TEXT CHECK (data_source IN ('official', 'recipe_derived', 'barcode', 'ocr', 'estimated', 'crowdsourced')),
    data_confidence TEXT CHECK (data_confidence IN ('high', 'medium', 'low')),
    source_url TEXT,
    barcode TEXT,
    derivation_path JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_brand ON menu_items(brand);
CREATE INDEX IF NOT EXISTS idx_menu_items_data_line ON menu_items(data_line);
CREATE INDEX IF NOT EXISTS idx_menu_items_confidence ON menu_items(data_confidence);

CREATE TABLE IF NOT EXISTS scraper_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    base_url TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT,
    template_id UUID REFERENCES scraper_templates(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    triggered_by TEXT,
    result_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS scrape_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
    raw_data JSONB NOT NULL,
    parsed_name TEXT,
    parsed_calories NUMERIC(10, 2),
    parsed_protein NUMERIC(10, 2),
    parsed_carbs NUMERIC(10, 2),
    parsed_fat NUMERIC(10, 2),
    ai_confidence TEXT,
    ai_notes TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_email TEXT,
    payload JSONB NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin user is created on first app startup via server/db/seed.py
-- Set ADMIN_EMAIL and ADMIN_PASSWORD in Railway environment variables

INSERT INTO scraper_templates (name, domain, base_url, config)
SELECT name, domain, base_url, config FROM (VALUES
    (
        'iCook 食譜',
        'icook.tw',
        'https://icook.tw/recipes/',
        '{"type": "icook_recipe", "data_line": "street_food"}'::jsonb
    ),
    (
        'Subway 台灣營養',
        'subway.com',
        'https://www.subway.com/zh-TW/menunutrition',
        '{"type": "subway_nutrition", "brand": "Subway", "data_line": "convenience_chain"}'::jsonb
    )
) AS v(name, domain, base_url, config)
WHERE NOT EXISTS (SELECT 1 FROM scraper_templates LIMIT 1);
