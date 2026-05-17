-- Supabase migration: add auto-reminder metadata fields to reminders
-- Ejecutar en SQL Editor de Supabase.

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS is_auto boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_key text,
  ADD COLUMN IF NOT EXISTS notified_thresholds integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_notified_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS reminders_auto_reminder_key_unique
  ON public.reminders (reminder_key)
  WHERE (is_auto = true AND reminder_key IS NOT NULL);

-- Asegura que los registros existentes se marquen como manuales.
UPDATE public.reminders
SET is_auto = false
WHERE is_auto IS NULL;

-- Elimina duplicados automáticos antiguos con el mismo reminder_key,
-- conservando el registro más reciente.
WITH latest_auto AS (
  SELECT reminder_key, MAX(created_at) AS latest_created_at
  FROM public.reminders
  WHERE is_auto = true AND reminder_key IS NOT NULL
  GROUP BY reminder_key
), keep_ids AS (
  SELECT r.id
  FROM public.reminders r
  JOIN latest_auto l
    ON r.reminder_key = l.reminder_key
   AND r.created_at = l.latest_created_at
  WHERE r.is_auto = true AND r.reminder_key IS NOT NULL
)
DELETE FROM public.reminders
WHERE is_auto = true AND reminder_key IS NOT NULL
  AND id NOT IN (SELECT id FROM keep_ids);
