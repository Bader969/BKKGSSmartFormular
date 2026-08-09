ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS crm_synced_at timestamptz;

CREATE TABLE public.crm_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  actor_id uuid,
  status text NOT NULL,
  entries integer NOT NULL DEFAULT 0,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crm_sync_log TO authenticated;
GRANT ALL ON public.crm_sync_log TO service_role;
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own crm sync log or admin"
ON public.crm_sync_log FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = crm_sync_log.application_id AND a.user_id = auth.uid()
  )
);

CREATE INDEX idx_crm_sync_log_app ON public.crm_sync_log(application_id, created_at DESC);