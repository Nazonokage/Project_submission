-- Fixes two DB/code drift issues found while auditing the repo after the
-- Phase 0 reset: schema.sql never picked up columns/values that got added
-- to schema.ts and the API routes while building Phase 8/9.

-- 1. tasks.sort_order — used by every task list/create/update query for
--    drag-and-drop ordering (src/app/api/student/tasks/*, src/app/api/prof/tasks/*)
--    but was never added to the DB.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;

-- 2. documentation_field_templates.field_type — the API validates and allows
--    'text' | 'textarea' | 'url' | 'date', but the DB CHECK constraint only
--    allowed 'text' | 'textarea'. Widen it to match.
ALTER TABLE "documentation_field_templates" DROP CONSTRAINT IF EXISTS "documentation_field_templates_field_type_check";
ALTER TABLE "documentation_field_templates" ADD CONSTRAINT "documentation_field_templates_field_type_check"
  CHECK ((field_type = ANY (ARRAY['text'::text, 'textarea'::text, 'url'::text, 'date'::text])));
