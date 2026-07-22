# BIG direkt gesund — Mitgliedsfelder in Variante A wiederherstellen

## Ziel
In `MemberSection` werden bei `selectedKrankenkasse === 'big_plusbonus'` und **ausgeschalteter** Familienversicherung (Variante A) aktuell viele Felder ausgeblendet (via `isBigMinimal`): Geburtsdatum, Geburtsort/-land, KV-Nummer, Name der Krankenkasse, Familienstand, Telefon, E-Mail sowie der Infoblock „Automatisch ausgefüllte Angaben". Diese Ausblendung war ursprünglich Absicht (siehe Memory `big-direkt-integration`), soll aber jetzt entfernt werden: Auch in Variante A müssen alle relevanten Mitgliedsfelder sichtbar sein — analog zu VIACTIV/DAK/BKK GS.

Novitas BKK bleibt **unangetastet**.

## Änderungen

### 1. `src/components/MemberSection.tsx`
- `isBigMinimal` auf konstant `false` setzen (bzw. Variable entfernen und alle `!isBigMinimal`-Guards auflösen), sodass alle Felder für BIG immer gerendert werden.
- `bigFull` bleibt für `required`/`validate`-Logik erhalten (Geschlecht, Familienstand Pflichtfelder nur in Variante B) — hier keine Änderung an Pflichtfeld-Logik.
- Der `isBigMinimal`-Block (Zeilen ~68–82, der aktuell nur Vorname/Name/Adresse für Variante A rendert) wird entfernt; stattdessen fällt Variante A in den regulären Render-Pfad.

### 2. `src/pages/Index.tsx` — Validierung
- Bestehende Ausnahme `formData.selectedKrankenkasse !== 'big_plusbonus'` für `mitgliedGeburtsdatum` (Zeile ~382) beibehalten: Geburtsdatum bleibt in Variante A **optional** (nicht Pflicht), damit das Formular weiterhin ohne Geburtsdatum exportierbar bleibt. Feld ist aber sichtbar und ausfüllbar.
- Keine Änderung an bestehenden Pflichtfeldregeln (Kontoinhaber, IBAN, Ort, Datum, Unterschrift bleiben Pflicht).

### 3. Trennlogik / Sicherheit
- Alle Anpassungen sind ausschließlich an `selectedKrankenkasse === 'big_plusbonus'` gebunden. Keine Berührung von Novitas-, VIACTIV-, DAK-, BKK-GS-Zweigen.
- Kein Export-Code (`bigPlusbonusExport.ts`, `bigFamversExport.ts`) wird geändert — AcroField-Mapping bleibt identisch, die Felder werden bereits korrekt ins PDF geschrieben, falls Werte vorhanden sind.

## Memory-Update nach Umsetzung
Memory `mem://features/big-direkt-integration` Absatz „Variante A" → Passus „HIDDEN in MemberSection for big_plusbonus …" entfernen und durch „Variante A zeigt vollständige MemberSection wie andere Provider; Geburtsdatum bleibt optional" ersetzen.

## Nicht betroffen
- Novitas BKK (UI + Autofill + Export)
- BIG Variante B (Familienversicherung) — Verhalten bleibt exakt gleich
- Alle anderen Kassen
