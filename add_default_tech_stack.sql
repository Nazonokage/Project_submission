-- Optional starting tags for new projects. Existing project choices stay unchanged.
ALTER TABLE project_slots ADD COLUMN IF NOT EXISTS default_tech_stack text[] NOT NULL DEFAULT '{}'::text[];
