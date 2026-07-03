
-- Delete duplicate whatsapp intake drafts (keep newest)
DELETE FROM public.applications WHERE source='whatsapp';
-- Reset inbox buffer so nothing lingers
DELETE FROM public.whatsapp_inbox_messages;
