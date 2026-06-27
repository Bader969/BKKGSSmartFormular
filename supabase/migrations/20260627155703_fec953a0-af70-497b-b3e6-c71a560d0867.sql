
CREATE EXTENSION IF NOT EXISTS citext;

-- allowed_emails
CREATE TABLE public.allowed_emails (
  email citext PRIMARY KEY,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_emails TO authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage allowed_emails"
  ON public.allowed_emails
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- admin_audit
CREATE TABLE public.admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit TO authenticated;
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view admin_audit"
  ON public.admin_audit
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Append-only: block updates/deletes
CREATE OR REPLACE FUNCTION public.prevent_admin_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit is append-only';
END;
$$;

CREATE TRIGGER admin_audit_no_update
  BEFORE UPDATE ON public.admin_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_audit_modification();

CREATE TRIGGER admin_audit_no_delete
  BEFORE DELETE ON public.admin_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_audit_modification();

-- Seed: allow the owner email and ensure admin role
INSERT INTO public.allowed_emails (email, note)
VALUES ('tarifygb@gmail.com', 'Projekt-Besitzer (Initial-Seed)')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE u.email = 'tarifygb@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
