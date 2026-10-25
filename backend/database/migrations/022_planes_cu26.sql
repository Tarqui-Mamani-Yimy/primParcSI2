-- CU26: align plan quotas with the use case ("hasta 2 sucursales en Básico vs. hasta 10 en
-- Profesional; habilitación del módulo de IA"). The internal codes stay unchanged because
-- Stripe price mappings and the clients compare by codigo; only the display name and limits move.
-- Re-runnable: each UPDATE sets absolute values.

UPDATE "Plan"
SET "limites" = jsonb_set("limites", '{sucursales}', '2'::jsonb)
WHERE "codigo" = 'basico';

UPDATE "Plan"
SET "nombre" = 'Profesional',
    "limites" = jsonb_set("limites", '{sucursales}', '10'::jsonb)
WHERE "codigo" = 'avanzado';
