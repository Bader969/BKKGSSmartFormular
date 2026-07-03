
-- 1) Puffer-Tabelle für eingehende WhatsApp-Nachrichten
CREATE TABLE public.whatsapp_inbox_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id text NOT NULL,
  wa_message_id text NOT NULL,
  type text NOT NULL,
  text text,
  media_url text,
  media_mime text,
  block_id uuid,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX whatsapp_inbox_wa_message_id_uniq
  ON public.whatsapp_inbox_messages (wa_message_id);

CREATE INDEX whatsapp_inbox_chat_received_idx
  ON public.whatsapp_inbox_messages (chat_id, received_at DESC);

CREATE INDEX whatsapp_inbox_block_idx
  ON public.whatsapp_inbox_messages (block_id);

GRANT ALL ON public.whatsapp_inbox_messages TO service_role;

ALTER TABLE public.whatsapp_inbox_messages ENABLE ROW LEVEL SECURITY;

-- Bewusst KEINE Policies für anon/authenticated: Zugriff nur über service_role (Edge Function).

-- 2) applications erweitern
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS intake_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS applications_source_idx
  ON public.applications (source);
