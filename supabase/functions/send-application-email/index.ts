import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Attachment = { filename: string; mimeType: string; base64: string };

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function toBase64UrlChunk(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_');
}

function base64EncodeUtf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

class MimeBase64UrlEncoder {
  private readonly parts: string[] = [];
  private carry = '';

  appendAscii(input: string): void {
    let offset = 0;

    if (this.carry) {
      const needed = 3 - this.carry.length;
      const prefix = input.slice(0, needed);
      this.carry += prefix;
      offset = prefix.length;

      if (this.carry.length === 3) {
        this.parts.push(toBase64UrlChunk(btoa(this.carry)));
        this.carry = '';
      }
    }

    const remaining = input.length - offset;
    const encodableLength = remaining - (remaining % 3);
    const end = offset + encodableLength;
    const chunkSize = 32766; // multiple of 3; keeps btoa/replace memory bounded

    for (let i = offset; i < end; i += chunkSize) {
      const chunk = input.slice(i, Math.min(i + chunkSize, end));
      this.parts.push(toBase64UrlChunk(btoa(chunk)));
    }

    this.carry = input.slice(end);
  }

  finish(): string {
    if (this.carry) {
      this.parts.push(toBase64UrlChunk(btoa(this.carry)).replace(/=+$/, ''));
      this.carry = '';
    }
    return this.parts.join('');
  }
}

function encodeMimeHeader(value: string): string {
  // RFC 2047 encoded-word for non-ASCII
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const b = btoa(unescape(encodeURIComponent(value)));
  return `=?UTF-8?B?${b}?=`;
}

function buildRawMessageBase64Url(opts: {
  from?: string; to: string; cc?: string; bcc?: string; subject: string; body: string; attachments: Attachment[];
}): string {
  const mixedBoundary = '----mixed_' + Math.random().toString(36).slice(2);
  const altBoundary = '----alt_' + Math.random().toString(36).slice(2);
  const messageId = `<${crypto.randomUUID()}@mail.gmail.com>`;
  const headers: string[] = [];
  if (opts.from) headers.push(`From: ${opts.from}`);
  headers.push(`To: ${opts.to}`);
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc) headers.push(`Bcc: ${opts.bcc}`);
  if (opts.from) headers.push(`Reply-To: ${opts.from}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`Message-ID: ${messageId}`);
  headers.push(`Subject: ${encodeMimeHeader(opts.subject)}`);
  headers.push('MIME-Version: 1.0');
  headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

  const encoder = new MimeBase64UrlEncoder();
  // Blank line separates headers from body (RFC 5322)
  encoder.appendAscii(headers.join('\r\n') + '\r\n\r\n');

  const plainBody = opts.body || '';
  const htmlBody =
    '<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap;">' +
    plainBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
    '</body></html>';

  const plainB64 = base64EncodeUtf8(plainBody);
  const htmlB64 = base64EncodeUtf8(htmlBody);

  // multipart/alternative wrapper for the body
  encoder.appendAscii(
    `--${mixedBoundary}\r\n` +
    `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n` +
    `--${altBoundary}\r\n` +
    'Content-Type: text/plain; charset="UTF-8"\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    'Content-Disposition: inline\r\n\r\n' +
    plainB64 + '\r\n' +
    `--${altBoundary}\r\n` +
    'Content-Type: text/html; charset="UTF-8"\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    'Content-Disposition: inline\r\n\r\n' +
    htmlB64 + '\r\n' +
    `--${altBoundary}--\r\n`,
  );

  for (const att of opts.attachments) {
    const safeName = encodeMimeHeader(att.filename);
    encoder.appendAscii(
      `--${mixedBoundary}\r\n` +
      `Content-Type: ${att.mimeType}; name="${safeName}"\r\n` +
      `Content-Disposition: attachment; filename="${safeName}"\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n',
    );
    encoder.appendAscii(att.base64);
    encoder.appendAscii('\r\n');
  }
  encoder.appendAscii(`--${mixedBoundary}--\r\n`);

  return encoder.finish();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const gmailKey = Deno.env.get('GOOGLE_MAIL_API_KEY');
  if (!lovableKey || !gmailKey) return json(500, { error: 'gmail_not_configured' });

  // JWT check
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
  };
  try { payload = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }

  const to = (payload.to || '').trim();
  const subject = (payload.subject || '').trim();
  const body = payload.body || '';
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  const allRecipients = [to, payload.cc || '', payload.bcc || '']
    .flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean);
  if (!allRecipients.length) return json(400, { error: 'no_recipient' });
  for (const r of allRecipients) if (!isValidEmail(r)) return json(400, { error: 'invalid_email', detail: r });
  if (!subject) return json(400, { error: 'no_subject' });
  if (!attachments.length) return json(400, { error: 'no_attachments' });

  // Size guard: ~24 MB raw base64
  const totalB64 = attachments.reduce((s, a) => s + (a.base64?.length || 0), 0);
  if (totalB64 > 32 * 1024 * 1024) return json(413, { error: 'attachments_too_large' });

  // Try to resolve the authenticated Gmail address for a proper From: header
  let fromHeader: string | undefined;
  try {
    const profileResp = await fetch('https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': gmailKey,
      },
    });
    if (profileResp.ok) {
      const prof = await profileResp.json().catch(() => ({} as any));
      if (prof?.emailAddress) fromHeader = String(prof.emailAddress);
    }
  } catch (_) { /* non-fatal */ }

  const rawB64Url = buildRawMessageBase64Url({ from: fromHeader, to, cc: payload.cc, bcc: payload.bcc, subject, body, attachments });

  const gmailResp = await fetch('https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': gmailKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawB64Url }),
  });

  if (!gmailResp.ok) {
    const text = await gmailResp.text();
    if (gmailResp.status === 403 && /insufficient/i.test(text)) {
      return json(200, { error: 'gmail_scope_missing' });
    }
    console.error('Gmail send failed', gmailResp.status, text.slice(0, 500));
    return json(502, { error: 'gmail_send_failed', status: gmailResp.status });
  }

  const gmailData = await gmailResp.json().catch(() => ({}));

  // Audit event (no PII): recipient domain, attachment count, person mapping
  let audit_error: string | null = null;
  if (payload.application_id) {
    try {
      const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const domain = to.split('@')[1] || '';
      const role = typeof payload.person_role === 'string' ? payload.person_role : 'main';
      const pIndex = typeof payload.person_index === 'number' ? payload.person_index : null;
      const pLabel = typeof payload.person_label === 'string' ? payload.person_label.slice(0, 160) : null;
      await admin.from('application_events').insert({
        application_id: payload.application_id,
        user_id: userData.user.id,
        event_type: 'emailed',
        meta: {
          to_domain: domain,
          attachments: attachments.length,
          gmail_id: gmailData.id ?? null,
          person_role: role,
          person_index: pIndex,
          person_label: pLabel,
          subject: subject.slice(0, 200),
        },
      });
    } catch (e) {
      audit_error = (e as Error).message;
      console.error('Audit insert failed', audit_error);
    }
  }

  return json(200, { ok: true, gmail_id: gmailData.id ?? null, audit_error });
});