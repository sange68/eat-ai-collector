-- add image_url column if missing
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
