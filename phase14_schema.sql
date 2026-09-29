CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS titles_text_trgm_idx ON titles USING gin (text gin_trgm_ops);
