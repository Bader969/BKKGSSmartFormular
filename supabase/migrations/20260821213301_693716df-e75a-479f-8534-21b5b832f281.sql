ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS crm_target text,
  ADD COLUMN IF NOT EXISTS crm_target_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS applications_crm_target_idx ON public.applications (crm_target);