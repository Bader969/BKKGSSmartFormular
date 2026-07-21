## Problem

Bei Novitas BKK mit `novitasMode = 'einzeln'` (nur Hauptmitglied):

1. **Betreff** enthält "Familienversicherung", obwohl kein FamVers-Antrag entsteht — `deriveAntragsform` liefert für Novitas immer `'Familienvers.'`.
2. **WhatsApp** wird übersprungen — der Dateisuch-Prefix ist auf `novitas_familienversicherung` fest verdrahtet; im Einzelmodus soll das PDF `Novitas_Beitritt_…` heißen.
3. **Stefanie-Vorlage** (Novitas + 400 €-Bonus) erscheint nicht im Textfeld — `setBody` schreibt beim Öffnen den Default-Body, die Bonus-Vorlage wird nur intern beim Senden gesetzt. Für den Nutzer sieht der Body falsch aus und lässt sich nicht editieren.

## Änderungen

### 1. `src/utils/antragsform.ts`
- Novitas-Case: bei `novitasMode === 'einzeln'` `'Beitritt'` zurückgeben, sonst weiter `'Familienvers.'`.

### 2. `src/utils/novitasExport.ts`
- Dateinamen abhängig vom Modus:
  - `familie` (Standard): `Novitas_Familienversicherung_{Vorname}_{Name}[_TeilN].pdf` (unverändert)
  - `einzeln`: `Novitas_Beitritt_{Vorname}_{Name}.pdf` (kein Teil-Split, da nur eine Person)
- Bei `einzeln` PDF nur einmal generieren (kein Kinder-Chunking).

### 3. `src/components/SendEmailDialog.tsx`
- **WhatsApp-Lookup** (~Zeile 621): Novitas-Summary matched auf `novitas_familienversicherung` **oder** `novitas_beitritt`. `waFilenameOverride = 'NovitasBKK_Beitritt.pdf'` bleibt.
- **Stefanie-Vorlage sichtbar machen**: In der `useEffect`-Initialisierung (~Zeile 405) prüfen `formData.selectedKrankenkasse === 'novitas' && formData.novitasBonus400` → `setBody(NOVITAS_BONUS_BODY_TEMPLATE)`. Anschließend darf `mainBodyTpl` schlicht `body || …` verwenden (Bonus-Sonderfall entfernen), damit der Nutzer die Vorlage im Textarea sieht/editieren kann und der versendete Text mit dem Angezeigten übereinstimmt.
- **Hauptmitglied-Anhänge (~Zeile 218)**: zusätzlich Prefix `novitas_beitritt` als Hauptmitglied-Datei erkennen (damit der Anhang der Einzelperson-Gruppe zugeordnet wird).

### 4. Keine Änderungen an
- `novitasSplit.ts` (liefert im Einzelmodus bereits nur `main`).
- Bookmarklet/Extraktion.
- `SEND_TO_WHATSAPP`-Default.

## Technischer Hinweis

Das Novitas-Antragsformular (`novitas-familienversicherung.pdf`) deckt sowohl Einzelbeitritt als auch Familienversicherung ab. Für den Einzelmodus wird also dasselbe PDF-Template verwendet, nur Dateiname + Betreff-Label ändern sich. Für den Bonus-Fall wird der WhatsApp-Dateiname weiter fix zu `NovitasBKK_Beitritt.pdf` überschrieben.
