-- Add the approved CU37/CU43/CU35 feature keys to both plans that include them.
-- Keep the update additive and idempotent without changing existing feature keys.
BEGIN;

UPDATE "Plan" AS plan
SET "features" = plan."features" || (
    SELECT COALESCE(jsonb_agg(to_jsonb(feature)), '[]'::jsonb)
    FROM unnest(ARRAY['promociones', 'fidelizacion', 'tallas']::text[]) AS additions(feature)
    WHERE NOT (plan."features" ? feature)
)
WHERE plan."codigo" IN ('intermedio', 'avanzado');

COMMIT;
