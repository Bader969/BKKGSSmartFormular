## Ziel

Nach WhatsApp-OCR sollen erkannte Familienmitglieder direkt korrekt im Editor landen — inkl. „Ja" bei Ehegatten-Frage und aktivierter Antragsvariante „Familienversicherung" (BIG). OCR/KI-Prompts werden verstärkt, damit Rollen (Mitglied / Ehegatte / Vater / Mutter / Kinder) und Familienstand zuverlässig erkannt werden.

## 1. Rollen-Erkennung im OCR-Prompt verstärken (alle Kassen)

`supabase/functions/process-insurance-gemini3/index.ts`

Gemeinsame Rollen-Heuristik als Prompt-Baustein an jeden Kassen-Prompt anhängen:
- Zielperson (Mitglied) steht im WhatsApp-Header — jene Person hat i. d. R. die eGK / Personalausweis
- Erwachsene mit gleicher Adresse & abweichendem Nachnamen/gleichem Nachnamen + Geburtsdatum-Nähe → Ehegatte/Lebenspartner
- Minderjährige (Geburtsdatum < 18 J. vor heute) mit gleicher Adresse → Kinder, Verwandtschaft `leiblich` als Default
- Aus Ausweis-Feld „Familienstand" oder Heiratsurkunde → `familienstand` setzen; wenn Ehegatte erkannt aber Feld fehlt → `familienstand: verheiratet`
- Geschlecht aus Anrede/Vorname/Ausweis
- Vater = männlicher erwachsener Elternteil, Mutter = weiblicher — für Kinder in `verwandtschaft` `leiblich` bleibt Default; Elternrolle wird über Geschlecht + Familienstand des Mitglieds abgebildet, nicht über eigenes Feld
- Explizit: „Wenn mehrere Personen erkennbar, IMMER alle in `ehegatte` bzw. `kinder[]` befüllen, niemals nur das Mitglied."

Zusätzlich Modell-Wechsel: aktueller Fast-Modus nutzt `flash`. Ergänzen: wenn `images.length <= 4` oder Rescan-Modus → `gemini-2.5-pro` für maximale Qualität; sonst `flash` (Timeout-Schutz bleibt).

## 2. Payload-Post-Processing im Intake

`supabase/functions/whatsapp-intake/index.ts` → `processBlock`, direkt vor `encryptPayload`:

Nach OCR anhand des Payloads Ableitungen setzen:
- Wenn `ocr.ehegatte?.vorname` oder `ocr.ehegatte?.name` vorhanden **oder** `ocr.kinder?.length > 0` → `familienstand ||= 'verheiratet'` (nur wenn OCR keinen anderen Wert lieferte)
- Für `selectedKrankenkasse === 'big_plusbonus'`:
  - `payload.bigFamilienversicherung = true`, wenn Ehegatte oder Kinder erkannt
  - `payload.bigMitgliedBeschaeftigt ||= 'beschaeftigt'` (Default für Variante A, wenn Familie erkannt)
- Für `viactiv`: `payload.viactivFamilienangehoerigeMitversichern = true`, wenn Ehegatte oder Kinder erkannt
- BKK GS: `payload.mode ||= 'familienversicherung_und_rundum'` wenn Familie erkannt

Damit landen die Flags direkt im verschlüsselten Payload und stehen beim Laden im Editor bereit.

## 3. Editor: „Ja" bei Ehegatte automatisch vorselektieren

`src/components/SpouseSection.tsx`

`hasSpouse` von reinem `useState(null)` auf initial-aus-Payload umstellen:
```
const [hasSpouse, setHasSpouse] = useState<boolean | null>(
  formData.ehegatte?.vorname || formData.ehegatte?.name ? true : null
);
```
Zusätzlich `useEffect`, der bei Änderung von `formData.ehegatte.vorname/name` (z. B. nach „In Editor laden") auf `true` setzt, falls noch `null`.

## 4. Verifikation

- Rescan des vorhandenen Blocks über `rescan_block_id`
- Erwartung: 2 Anträge, jeweils mit `bigFamilienversicherung=true` (falls Familie erkannt), `familienstand='verheiratet'`, korrekte Zuordnung Ehegatte/Kinder
- Im Editor: „Ja" ist bei Ehegatte-Frage vorausgewählt, Ehegatten-Formular sofort sichtbar

## Technisch (kurz)

- Keine Schemaänderungen an bestehenden `ehegatte`/`kinder`-Feldern nötig — nur zusätzliche Regeln im Prompt.
- Ableitungen im Intake sind idempotent (nur setzen wenn leer).
- `SpouseSection` bleibt lokal-state-basiert, aber lädt Initialwert aus Payload.
