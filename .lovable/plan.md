## 1. Signatur-Fonts einbinden & randomisieren

**Fonts ins Projekt:** Die 9 hochgeladenen Schriften (`Rilona Notes`, `Arabella Forteny`, `Signature Present`, `Gartenya Calligraph`, `Millenial`, `Melisma Signature`, `Destomed`, `OTF`) nach `public/fonts/` kopieren und per `@font-face` in `src/index.css` registrieren. Tailwind-Token `font-signature` bleibt, aber als Fallback-Cursive.

**Random-Auswahl pro Antrag:**
- Neuer Helper `pickSignatureFont(seed: string)` in `src/utils/generateSignature.ts`. 
- Seed = stabiler Hash aus `Vorname + Nachname + Geburtsdatum` der jeweiligen unterschreibenden Person → gleiche Person bekommt immer dieselbe Schrift (kein Wechsel bei jedem Re-Render), unterschiedliche Personen unterschiedliche Schriften, Mitglied vs. Familie ggf. unterschiedlich.
- `generateSignatureDataUrl()` akzeptiert zusätzlich `fontFamily` (oder leitet aus Seed ab) und nutzt diese Schrift fürs Canvas-Rendering. Größe wird wie bisher auto-skaliert.
- `getAutoSignatures(formData)` übergibt die korrekten Seeds (Mitglied / Familie).
- `SignaturePreview` bekommt optional `seed`-Prop und nutzt denselben Font für die On-Screen-Vorschau (inline `style.fontFamily`), damit Vorschau = PDF-Ausgabe.
- `ensureSignatureFontReady()` lädt alle 9 Schriften vorab (`document.fonts.load` Loop).

## 2. BIG Plusbonus: Unterschrift aus Kontoinhaber-Nachname

In `src/utils/bigPlusbonusExport.ts` (Variante A und B-Mitgliedseintrag) und in `SignatureSection`-Vorschau (nur wenn `selectedKrankenkasse === 'big_plusbonus'`):

- Neue Helper-Funktion `resolveBigSignatureLastName(formData)`: nimmt `formData.bigBank.kontoinhaber`, splittet am letzten Leerzeichen, gibt letztes Wort zurück. Fallback auf `mitgliedName`, falls leer.
- `SignatureSection` zeigt für BIG diesen Namen statt `mitgliedName`.
- `exportBigPlusbonus` ruft `generateSignatureDataUrl(resolveBigSignatureLastName(formData))` statt `getAutoSignatures(...).member` für die Mitglieds-Unterschrift. Familien-Slot (Variante B) bleibt unverändert.

## 3. Gmail-Bugfix: leerer Body & Spam

In `supabase/functions/send-application-email/index.ts`:

- **Body-Fix:** RFC 2822 verlangt eine Leerzeile zwischen Headern und Body. Aktuell wird nur ein `\r\n` nach den Headern gesetzt → Gmail wertet den text/plain-Part als Preamble und zeigt nur die Anhänge. Auf `\r\n\r\n` umstellen.
- **Spam-Reduzierung:** zusätzliche Header setzen: `From: "{Anzeigename}" <{authenticated gmail address}>` (via Gmail `users.getProfile` einmalig ermitteln oder aus Token), `Reply-To` = `From`, `Date` (RFC 2822), `Message-ID: <uuid@gmail.com>`, `MIME-Version` bleibt. Body-Part bekommt zusätzlich `Content-Disposition: inline`. 
- HTML-Alternative: Body als `multipart/alternative` (text/plain + minimaler text/html) verpacken und in `multipart/mixed` einbetten — reine Plaintext+Attachments triggert Spamfilter eher.
- Function neu deployen.

## 4. Technische Details

- Fonts werden als `.ttf/.otf` ausgeliefert (kein Asset-CDN nötig, da im Browser von index.css referenziert).
- Hash für Seed: kleiner FNV-1a (8 Zeichen ausreichend), Index = `hash % FONTS.length`.
- Keine DB-Migration, kein neuer Edge-Function-Endpoint.

**Geänderte Dateien:** `src/index.css`, `public/fonts/*` (neu), `src/utils/generateSignature.ts`, `src/components/SignaturePreview.tsx`, `src/components/SignatureSection.tsx`, `src/utils/bigPlusbonusExport.ts`, `supabase/functions/send-application-email/index.ts`.
