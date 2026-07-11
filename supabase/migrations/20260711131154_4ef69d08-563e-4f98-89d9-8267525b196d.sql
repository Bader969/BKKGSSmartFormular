ALTER TABLE public.application_events DROP CONSTRAINT IF EXISTS application_events_event_type_check;
ALTER TABLE public.application_events ADD CONSTRAINT application_events_event_type_check
  CHECK (event_type IN ('created','updated','exported','opened','decrypted','deleted','emailed','whatsapp_sent','whatsapp_intake'));