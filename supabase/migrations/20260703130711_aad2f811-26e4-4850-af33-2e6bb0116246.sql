
-- Explicit deny-all policy for whatsapp_inbox_messages so linter is satisfied.
-- The Edge Function uses service_role which bypasses RLS.
CREATE POLICY "deny all authenticated"
  ON public.whatsapp_inbox_messages
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
