
## Was ist passiert (Analyse der letzten Aufnahme)

Aus DB + Edge-Logs für Block `80fc6010…` (heute 14:10–14:14):

- **Block korrekt geschlossen** zwischen den zwei „...“-Trennern. 8 Bilder + 1 Telefon + 1 E-Mail + **2 Header** (Fatema, Mahmoud) wurden gepuffert und atomar geclaimed.
- **OCR ist NICHT durchgelaufen.** Der Aufruf an `process-insurance-gemini3` lieferte HTTP **504 (Gateway Timeout)**. Warnings im `intake_meta`: `"OCR fehlgeschlagen (Status 504)."` Es kam also **kein JSON** aus dem Modell zurück — nichts wurde per OCR in Felder eingetragen.
- **Nur 1 Entwurf statt 2 gespeichert.** Der Code liest im Block nur den **ersten** Header (`rows.find(type==="header")`) und erzeugt genau eine `applications`-Zeile. Fatema wurde gespeichert, **Mahmoud ignoriert**, obwohl klar ein zweiter Header + eigener Bildersatz drin war.
- **Gespeichert wurde nur der Header:** Vorname, Name, Datum, Krankenkasse (`big_plusbonus`), Vertriebspartner (Gh Blitzvox), Telefon, E-Mail — payload ist nur ~255 Bytes.
- **Zweiter, älterer Draft** (`3846f7f0…`, 14:09) stammt aus einem früheren Versand vor dem Deduplizierungs-Fix und hat ebenfalls ein OCR-504.

## Warum lädt der Antrag nicht in den Editor?

Der Load-Pfad (`ApplicationDetailDrawer.handleLoad` → `decrypt` → `sessionStorage` → `Index.tsx` Hydrate) ist grundsätzlich intakt. Bei einem Payload mit nur den Header-Feldern *sollte* der Editor die Krankenkasse setzen und die Namensfelder füllen. Ich muss vor dem Fix noch einmal live prüfen, ob (a) `decrypt` bereits einen Fehler wirft, oder (b) das Payload zwar landet, aber im UI leer wirkt, weil außer Name/KK nichts drin ist. Beides fixe ich unten.

## Plan

### 1. Mehr-Personen-Block: pro Header 1 Antrag
`whatsapp-intake/index.ts → processBlock`:
- Header-Zeilen einsammeln (`headers = rows.filter(type==="header")`) statt nur die erste.
- Bilder chronologisch den Headern zuordnen: alle Bilder vor Header[1] gehören zu Header[0], usw. (Telefon/E-Mail bleiben blockweit gemeinsam, weil im Screenshot nur einmal gesendet).
- OCR + Insert pro Header ausführen, jeweils eigenen `applications`-Eintrag; alle teilen `intake_meta.block_id`.
- Wenn nur 1 Header vorhanden: Verhalten unverändert.

### 2. OCR-Timeout robuster machen
`whatsapp-intake/index.ts`:
- Timeout auf den OCR-Fetch (AbortController, ~110 s) und **einmaliges Retry** bei 5xx/Timeout.
- Bei Bild-Batches >6 Bilder: OCR in Chunks von 6 Bildern splitten und die JSON-Ergebnisse feldweise mergen — verhindert die 504-Timeouts, die aktuell jedes Mal alles verwerfen.
- Warnings so schreiben, dass klar wird, ob 504 vor oder nach Retry auftrat.

### 3. Load-Pfad hart machen
`ApplicationDetailDrawer.handleLoad`:
- Fehlerdetails im Toast + `console.error`, damit ein zukünftiger Ladefehler diagnostizierbar ist statt still.
`Index.tsx` Hydrate:
- Wenn `payload.selectedKrankenkasse` gesetzt ist, sicherstellen, dass abhängige Sichtbarkeits-States (z. B. Big-Variante A/B) sinnvoll starten (Variante A default), damit ein „mageres“ Payload nicht wie ein leeres Formular aussieht.

### 4. Aufräumen der aktuellen 2 Test-Drafts
Beide bestehenden WhatsApp-Drafts (`3846f7f0`, `029de8ce`) via `DELETE FROM applications WHERE source='whatsapp'` entfernen; Buffer bleibt geleert. So können wir sauber neu testen.

### 5. Verifikation
Nach Deploy: eine neue `.` senden — erwartet werden **2 Anträge** (Fatema + Mahmoud), jeweils mit OCR-JSON-Feldern (Adresse, Geburtsdatum, IBAN etc.), keine 504-Warning mehr, und „In Editor laden“ öffnet das Formular mit den Feldern gefüllt.

## Technisch (kurz)

- `findClosedBlocks` unverändert.
- Bild-Zuordnung: Reihenfolge `rows` nach `received_at` sortiert (bereits so aus DB); Iteration über rows, ein „current header“-Zeiger; Bilder werden dem aktuellen Header zugeordnet, bei nächstem Header wechselt der Zeiger.
- OCR-Chunking: `chunk(images, 6)`, jeweils `POST /process-insurance-gemini3`, Ergebnis mergen mit `Object.assign({}, ...ocrResults)` (letzter nicht-leerer Wert gewinnt pro Feld) — reicht, weil das Modell pro Chunk dieselben Zielfelder befüllt.
- Retry: einmalig, 2 s Backoff, nur auf Status 502/503/504/timeout.
