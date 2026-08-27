import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Attachment = { filename: string; mimeType: string; base64: string };

const FROM_EMAIL = 'antraege@beitplus.de';
const FROM_HEADER = `Beit Plus <${FROM_EMAIL}>`;
const BUCKET = 'email-attachments';

const baseUrl = (v: string) => v.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

const BEITPLUS_URL = baseUrl(
  Deno.env.get('BEITPLUS_CRM_SUPABASE_URL') ?? 'https://cfruyzidaiwwfoexbfyq.supabase.co',
);
const BEITPLUS_ANON_KEY = Deno.env.get('BEITPLUS_CRM_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmcnV5emlkYWl3d2ZvZXhiZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTk2MjEsImV4cCI6MjA5Nzc5NTYyMX0.oXEOeqJmc2hfNqsiMVTsKOYx8HtZSkpPMyW9eS7OgXo';
const BEITPLUS_EMAIL = Deno.env.get('BEITPLUS_CRM_EMAIL') ?? '';
const BEITPLUS_PASSWORD = Deno.env.get('BEITPLUS_CRM_PASSWORD') ?? '';
const BEITPLUS_SERVICE_ROLE_KEY = Deno.env.get('BEITPLUS_CRM_SERVICE_ROLE_KEY') ?? '';

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function splitList(v?: string): string[] {
  return (v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function snippetOf(s: string, max = 200): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'anhang';
}

/** Client für das BeitPlus-CRM: Service-Role falls hinterlegt, sonst Admin-Login (RLS greift). */
async function beitplusClient() {
  if (BEITPLUS_SERVICE_ROLE_KEY) {
    return {
      client: createClient(BEITPLUS_URL, BEITPLUS_SERVICE_ROLE_KEY, { auth: { persistSession: false } }),
      userId: null as string | null,
    };
  }
  if (!BEITPLUS_EMAIL || !BEITPLUS_PASSWORD) {
    throw new Error('beitplus_credentials_missing');
  }
  const client = createClient(BEITPLUS_URL, BEITPLUS_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: BEITPLUS_EMAIL,
    password: BEITPLUS_PASSWORD,
  });
  if (error) throw new Error(`beitplus_login_failed:${error.message}`);
  return { client, userId: data.user?.id ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return json(500, { error: 'resend_not_configured' });

  // JWT-Prüfung gegen das eigene Projekt
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer /i, '');
  if (!token) return json(401, { error: 'unauthorized' });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: 'unauthorized' });

  let payload: {
    application_id?: string | null;
    to?: string; cc?: string; bcc?: string;
    subject?: string; body?: string;
    attachments?: Attachment[];
    person_role?: string | null;
    person_index?: number | null;
    person_label?: string | null;
    probe?: boolean;
    backfill_resend_id?: string;
  };
  try { payload = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }

  // Verbindungstest ohne Versand
  if (payload.probe) {
    try {
      const c = await beitplusClient();
      const { error: selErr } = await c.client.from('emails').select('id').limit(1);
      return json(200, { ok: !selErr, mode: BEITPLUS_SERVICE_ROLE_KEY ? 'service_role' : 'login', read_error: selErr?.message ?? null });
    } catch (e) {
      return json(200, { ok: false, error: (e as Error).message });
    }
  }

  // Nachtrag: bereits über Resend versandte E-Mail im BeitPlus-Postfach eintragen
  if (payload.backfill_resend_id) {
    try {
      const r = await fetch(`https://api.resend.com/emails/${payload.backfill_resend_id}`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const t = await r.text();
      if (!r.ok) return json(502, { error: 'resend_lookup_failed', status: r.status, detail: t.slice(0, 300) });
      const m = JSON.parse(t) as {
        to?: string[]; cc?: string[]; bcc?: string[];
        subject?: string; html?: string; text?: string;
        created_at?: string; last_event?: string;
      };
      const c = await beitplusClient();
      const { data: existing } = await c.client
        .from('emails')
        .select('id')
        .eq('provider_message_id', payload.backfill_resend_id)
        .limit(1);
      if (existing?.length) return json(200, { ok: true, already_present: true, email_id: existing[0].id });
      const { data: ins, error: insErr } = await c.client
        .from('emails')
        .insert({
          direction: 'outbound',
          status: 'sent',
          sender_email: FROM_EMAIL,
          recipient_email: m.to?.[0] ?? '',
          cc: m.cc?.length ? m.cc : null,
          bcc: m.bcc?.length ? m.bcc : null,
          subject: m.subject ?? '',
          body_html: m.html ?? null,
          body_text: m.text ?? null,
          snippet: snippetOf(m.text || (m.html || '').replace(/<[^>]*>/g, ' ')),
          provider_message_id: payload.backfill_resend_id,
          sent_by: c.userId,
          sent_at: m.created_at ?? new Date().toISOString(),
        })
        .select('id')
        .single();
      if (insErr) return json(500, { error: 'insert_failed', detail: insErr.message });
      return json(200, { ok: true, email_id: ins.id, recipient: m.to?.[0] ?? null, note: 'Anhänge nicht nachtragbar' });
    } catch (e) {
      return json(500, { error: 'backfill_failed', detail: (e as Error).message });
    }
  }





  const to = splitList(payload.to);
  const cc = splitList(payload.cc);
  const bcc = splitList(payload.bcc);
  const subject = (payload.subject || '').trim();
  const body = payload.body || '';
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  const all = [...to, ...cc, ...bcc];
  if (!all.length) return json(400, { error: 'no_recipient' });
  for (const r of all) if (!isValidEmail(r)) return json(400, { error: 'invalid_email', detail: r });
  if (!subject) return json(400, { error: 'no_subject' });
  if (!attachments.length) return json(400, { error: 'no_attachments' });

  const totalB64 = attachments.reduce((s, a) => s + (a.base64?.length || 0), 0);
  if (totalB64 > 32 * 1024 * 1024) return json(413, { error: 'attachments_too_large' });

  const bodyHtml =
    '<pre style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap;margin:0">' +
    escapeHtml(body) +
    '</pre>';

  // 1) BeitPlus-Verbindung (optional) + Anhänge in den Postfach-Bucket legen
  let crm: Awaited<ReturnType<typeof beitplusClient>> | null = null;
  let crm_log_error: string | null = null;
  try {
    crm = await beitplusClient();
  } catch (e) {
    crm_log_error = (e as Error).message;
    console.error('BeitPlus connect failed (Versand läuft weiter)', crm_log_error);
  }

  const folder = `outbound/${crypto.randomUUID()}`;
  const stored: Array<{ path: string; filename: string; contentType: string; size: number }> = [];
  let storageWarning: string | null = null;

  if (crm) {
    for (const att of attachments) {
      const bytes = base64ToBytes(att.base64 || '');
      const path = `${folder}/${safeName(att.filename)}`;
      const { error: upErr } = await crm.client.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: att.mimeType || 'application/pdf', upsert: true });
      if (upErr) {
        storageWarning = upErr.message;
        console.error('Attachment upload failed', att.filename, upErr.message);
        continue;
      }
      stored.push({ path, filename: att.filename, contentType: att.mimeType || 'application/pdf', size: bytes.length });
    }
  }


  // 2) Versand über Resend mit dem bestehenden BeitPlus-Absender
  const resendPayload: Record<string, unknown> = {
    from: FROM_HEADER,
    to,
    reply_to: FROM_EMAIL,
    subject,
    text: body || undefined,
    html: bodyHtml,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.base64,
      content_type: a.mimeType || 'application/pdf',
    })),
  };
  if (cc.length) resendPayload.cc = cc;
  if (bcc.length) resendPayload.bcc = bcc;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify(resendPayload),
  });
  const respText = await resp.text();
  let parsed: Record<string, unknown> | null = null;
  try { parsed = respText ? JSON.parse(respText) : null; } catch { /* raw behalten */ }

  if (!resp.ok) {
    const message = String((parsed as { message?: string } | null)?.message || respText || `resend_${resp.status}`);
    console.error('Resend send failed', resp.status, message.slice(0, 500));
    // Fehlversuch im BeitPlus-Postfach protokollieren
    try {
      if (!crm) throw new Error(crm_log_error || 'beitplus_not_connected');

      await crm.client.from('emails').insert({
        direction: 'outbound',
        status: 'failed',
        sender_email: FROM_EMAIL,
        recipient_email: to[0],
        cc: cc.length ? cc : null,
        bcc: bcc.length ? bcc : null,
        subject,
        body_html: bodyHtml,
        body_text: body || null,
        snippet: snippetOf(body),
        error_message: message,
        sent_by: crm.userId,
      });
    } catch (e) {
      console.error('BeitPlus failure log insert failed', (e as Error).message);
    }
    return json(502, { error: 'resend_send_failed', status: resp.status, detail: message.slice(0, 300) });
  }

  const providerId = (parsed as { id?: string } | null)?.id ?? null;

  // 3) Gesendet-Eintrag im BeitPlus-Postfach
  try {
    if (!crm) throw new Error(crm_log_error || 'beitplus_not_connected');
    const { data: inserted, error: insErr } = await crm.client
      .from('emails')
      .insert({
        direction: 'outbound',
        status: 'sent',
        sender_email: FROM_EMAIL,
        recipient_email: to[0],
        cc: cc.length ? cc : null,
        bcc: bcc.length ? bcc : null,
        subject,
        body_html: bodyHtml,
        body_text: body || null,
        snippet: snippetOf(body),
        provider_message_id: providerId,
        sent_by: crm.userId,
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insErr) throw new Error(insErr.message);
    if (stored.length) {
      const { error: attErr } = await crm.client.from('email_attachments').insert(
        stored.map((a) => ({
          email_id: inserted.id,
          filename: a.filename,
          content_type: a.contentType,
          size: a.size,
          storage_path: a.path,
        })),
      );
      if (attErr) throw new Error(attErr.message);
    }
  } catch (e) {
    crm_log_error = (e as Error).message;
    console.error('BeitPlus sent-log failed', crm_log_error);
  }

  // 4) Audit-Event im eigenen Projekt (ohne PII)
  let audit_error: string | null = null;
  if (payload.application_id) {
    try {
      const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await admin.from('application_events').insert({
        application_id: payload.application_id,
        user_id: userData.user.id,
        event_type: 'emailed',
        meta: {
          via: 'beitplus',
          to_domain: to[0]?.split('@')[1] || '',
          attachments: attachments.length,
          resend_id: providerId,
          person_role: typeof payload.person_role === 'string' ? payload.person_role : 'main',
          person_index: typeof payload.person_index === 'number' ? payload.person_index : null,
          person_label: typeof payload.person_label === 'string' ? payload.person_label.slice(0, 160) : null,
          subject: subject.slice(0, 200),
        },
      });
    } catch (e) {
      audit_error = (e as Error).message;
      console.error('Audit insert failed', audit_error);
    }
  }

  return json(200, { ok: true, resend_id: providerId, audit_error, crm_log_error, storage_warning: storageWarning });
});
