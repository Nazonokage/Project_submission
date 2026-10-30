-- Run with the matching application release. No schema changes are needed.
-- Keep differing legacy text as history, retire the independently editable copy.
WITH legacy AS (
  SELECT id, description, documentation,
    CASE WHEN jsonb_typeof(documentation->'abstract') = 'string'
      THEN documentation->>'abstract' ELSE '' END AS abstract_text
  FROM titles
  WHERE jsonb_typeof(documentation) = 'object' AND documentation ? 'abstract'
)
UPDATE titles AS t
SET description = CASE WHEN btrim(legacy.description) = ''
      THEN btrim(legacy.abstract_text) ELSE legacy.description END,
    documentation = (legacy.documentation - 'abstract') ||
      CASE WHEN btrim(legacy.abstract_text) <> '' AND btrim(legacy.description) <> ''
        AND btrim(legacy.abstract_text) <> btrim(legacy.description)
      THEN jsonb_build_object('_legacyAbstracts',
        (CASE WHEN jsonb_typeof(legacy.documentation->'_legacyAbstracts') = 'array'
          THEN legacy.documentation->'_legacyAbstracts' ELSE '[]'::jsonb END) ||
        CASE WHEN COALESCE(legacy.documentation->'_legacyAbstracts', '[]'::jsonb)
          @> jsonb_build_array(legacy.abstract_text) THEN '[]'::jsonb
          ELSE jsonb_build_array(legacy.abstract_text) END)
      ELSE '{}'::jsonb END
FROM legacy WHERE t.id = legacy.id;

UPDATE documentation_field_templates
SET label = 'Description / Abstract'
WHERE field_key = 'abstract' AND label IN ('Abstract', 'Description');
