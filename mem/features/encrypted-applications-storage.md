---
name: Encrypted Applications Storage
description: AES-GCM-encrypted persistence of completed applications with per-user + admin RLS and append-only audit log
type: feature
---
Completed application records are persisted in `public.applications` with AES-GCM-256 encryption via the `applications-api` edge function.

Rules:
- Encryption key lives ONLY in the `APPLICATIONS_ENCRYPTION_KEY` edge-function secret. Never expose, log, or copy it into the client or database.
- Encrypt/decrypt happens server-side in `applications-api` only. The browser sends/receives plaintext over HTTPS at request time and never stores it.
- RLS: a row is readable/editable/deletable by its owner (`auth.uid() = user_id`) or by an admin (`user_roles.role = 'admin'`). Inserts only for `auth.uid() = user_id`.
- `payload_hash` (SHA-256 over canonical JSON) is for duplicate detection only — never display it.
- `application_events` is append-only (DB trigger blocks UPDATE/DELETE). `meta` must NEVER contain names, dates of birth, KV-numbers, addresses, or any other PII. Allowed: `krankenkasse`, `pdf_count`, structural counts.
- Edge-function logs MUST NOT contain payload contents, decrypted values, or user-typed strings. Return generic `{ error: "<slug>" }` on failure.
- This rule does NOT override the AI-capture ephemeral-processing rule — uploaded documents during AI OCR still must not be persisted anywhere.