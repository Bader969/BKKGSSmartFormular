import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const WHAPI_BASE = 'https://gate.whapi.cloud';

async function whapi(path: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${WHAPI_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function sendText(token: string, to: string, text: string): Promise<void> {
  const r = await whapi('/messages/text', token, { to, body: text });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`whapi text failed ${r.status}: ${t.slice(0, 200)}`);
  }
}

async function sendDocument(token: string, to: string, base64: string, filename: string): Promise<void> {
  const media = `data:application/pdf;base64,${base64}`;
  const r = await whapi('/messages/document', token, { to, media, filename });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`whapi document failed ${r.status}: ${t.slice(0, 200)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const whapiToken = Deno.env.get('WHAPI_TOKEN');
  if (!whapiToken) return json(500, { error: 'whapi_not_configured' });

  // JWT check
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer /i, '');
  if (!token) return json(401, { error: 'unauthorized' });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: 'unauthorized' });

  let payload: {
    application_id?: string | null;
    chatId?: string;
    pdfBase64?: string;
    pdfFilename?: string;
    textLines?: string[];
  };
  try { payload = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }

  const chatId = (payload.chatId || '').trim();
  const pdfBase64 = payload.pdfBase64 || '';
  const pdfFilename = (payload.pdfFilename || '').trim();
  const textLines = Array.isArray(payload.textLines) ? payload.textLines.filter((l) => typeof l === 'string' && l.trim()) : [];

  if (!chatId) return json(400, { error: 'no_chat_id' });
  if (!pdfBase64) return json(400, { error: 'no_pdf' });
  if (!pdfFilename) return json(400, { error: 'no_filename' });
  if (!textLines.length) return json(400, { error: 'no_text' });

  try {
    // 3× dot
    for (let i = 0; i < 3; i++) await sendText(whapiToken, chatId, '.');
    // document
    await sendDocument(whapiToken, chatId, pdfBase64, pdfFilename);
    // text
    await sendText(whapiToken, chatId, textLines.join('\n'));
    // 3× dot
    for (let i = 0; i < 3; i++) await sendText(whapiToken, chatId, '.');
  } catch (e) {
    console.error('whatsapp send failed', (e as Error).message);
    return json(502, { error: 'whatsapp_send_failed', detail: (e as Error).message });
  }

  // Audit
  if (payload.application_id) {
    try {
      const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await admin.from('application_events').insert({
        application_id: payload.application_id,
        user_id: userData.user.id,
        event_type: 'whatsapp_sent',
        meta: { chat_id: chatId, filename: pdfFilename },
      });
    } catch (e) {
      console.error('Audit insert failed', (e as Error).message);
    }
  }

  return json(200, { ok: true });
});