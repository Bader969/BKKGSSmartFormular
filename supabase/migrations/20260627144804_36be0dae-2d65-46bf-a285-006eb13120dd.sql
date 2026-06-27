
-- Applications table: encrypted PII storage with per-user RLS + admin access
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  krankenkasse text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','exported')),
  payload_encrypted bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_hash text NOT NULL,
  pdf_count integer NOT NULL DEFAULT 0,
  exported_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications or admin all"
  ON public.applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own applications"
  ON public.applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own applications or admin"
  ON public.applications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own applications or admin"
  ON public.applications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_applications_user_id ON public.applications(user_id);
CREATE INDEX idx_applications_krankenkasse ON public.applications(krankenkasse);
CREATE INDEX idx_applications_payload_hash ON public.applications(payload_hash);

-- Audit log: append-only, no PII allowed in meta
CREATE TABLE public.application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created','updated','exported','opened','decrypted','deleted')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only service_role can insert; authenticated can read own + admin reads all
GRANT SELECT ON public.application_events TO authenticated;
GRANT ALL ON public.application_events TO service_role;

ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own events or admin all"
  ON public.application_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies for authenticated → only service_role can write.

CREATE INDEX idx_application_events_application_id ON public.application_events(application_id);
CREATE INDEX idx_application_events_user_id ON public.application_events(user_id);
CREATE INDEX idx_application_events_created_at ON public.application_events(created_at DESC);

-- Block UPDATE/DELETE on events even for service_role to enforce append-only at the DB level
CREATE OR REPLACE FUNCTION public.prevent_application_events_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'application_events is append-only';
END;
$$;

CREATE TRIGGER application_events_no_update
  BEFORE UPDATE ON public.application_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_application_events_modification();

CREATE TRIGGER application_events_no_delete
  BEFORE DELETE ON public.application_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_application_events_modification();
