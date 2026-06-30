## Ziel
BIG direkt gesund — Korrekturen an Unterschriften, Eigene-Mitgliedschaft-Logik (analog VIACTIV), pro-Person Versicherungsdaten und getrennter E-Mail-Versand pro eigenständigem Mitglied.

---

## 1. Unterschriften korrigieren

### 1a. Familienversicherungs-Antrag (`bigFamversExport.ts`)
- Mitglieds-Unterschrift: **Nachname des Hauptantragstellers** → `generateSignatureDataUrl(formData.mitgliedName, …)` statt aktuell aus Kontoinhaber.
- Familienangehörigen-Unterschrift (links unten): **Nachname des Ehegatten** → `generateSignatureDataUrl(formData.ehegatte.name, …)`. Fallback: ältestes Kind ≥15 nur wenn kein Ehegatte vorhanden.

### 1b. Plusbonus-Antrag (`bigPlusbonusExport.ts`)
- Unterschrift = **Nachname des Kontoinhabers**, aus neuem Feld `formData.bigBank.kontoinhaberNachname`.
- Pro eigene-Mitgliedschaft-Plusbonus (Ehegatte/Kind): Unterschrift = Nachname dieser Person (aus eigenen, neuen `eigenePlusbonus.kontoinhaberNachname`, siehe §3).

### 1c. UI-Trennung Kontoinhaber (`BigPlusbonusSection.tsx`)
- `bigBank.kontoinhaber` (single) → ersetzen durch `kontoinhaberVorname` + `kontoinhaberNachname` (zwei Felder, Vorname zuerst).
- `resolveBigSignatureLastName` in `generateSignature.ts` liest jetzt direkt `bigBank.kontoinhaberNachname`.
- Beim PDF-Export wird das AcroField `Kontoinhaberin` mit `"Vorname Nachname"` (zusammen) gefüllt.
- Auto-Sync `Vorname Name` → Kontoinhaber-Felder beibehalten (jetzt feldweise).

---

## 2. Eigene-Mitgliedschaft-Logik (wie VIACTIV)

### 2a. Auto-Sync in `Index.tsx` (Variante B)
Ersetzt aktuelle pauschale Logik:

```text
beschäftigt:
  - Ehegatte: own=false (familienversichert)
    außer ehegatte.beschaeftigung === 'beschaeftigt' → own=true
  - Kinder: für jedes Kind:
      alter ≥15 UND kind.beschaeftigung === 'beschaeftigt' → own=true
      sonst own=false

arbeitslos:
  - Ehegatte: own=true (immer)
  - Kinder: alter ≥15 → own=true, sonst own=false
```

`bisherigArt` wird parallel auf `'mitgliedschaft'` / `'familienversicherung'` gesetzt.

### 2b. UI
- `SpouseSection`: bei BIG Variante B Dropdown „Beschäftigungsstatus Ehegatte" (analog VIACTIV `beschaeftigung`-Optionen), zeigt nur bei Hauptmitglied=beschäftigt; Checkbox „Eigene Mitgliedschaft" als read-only/abgeleitet anzeigen.
- `ChildrenSection`: pro Kind ab 15 Jahren Dropdown „Beschäftigungsstatus" (nur sichtbar bei Hauptmitglied=beschäftigt). Manuelle Checkbox „Eigene Mitgliedschaft" entfällt — wird automatisch abgeleitet und nur als Info angezeigt.

---

## 3. Pro-Person Versicherungsdaten (Plusbonus pro Person)

### 3a. Neuer Datentyp pro Person
Neues Objekt `eigenePlusbonus` an `FamilyMember` (Ehegatte + Kinder), nur befüllt wenn `eigeneMitgliedschaft=true`:

```ts
eigenePlusbonus: {
  versicherungsstatus: 'neuabschluss' | 'bestehend' | '';
  hoeheEuro: string;
  versicherungsarten: { privateZusatz, berufsunfaehigkeit, unfall, grundfaehigkeit };
  bank: BigBankDaten;  // inkl. eigene kontoinhaberVorname/-Nachname
}
```

### 3b. UI
Neue Sektion „Eigener Plusbonus für {Vorname Name}" in `SpouseSection` und `ChildrenSection`, eingeblendet sobald `eigeneMitgliedschaft===true`. Enthält dieselben Felder wie `BigPlusbonusSection` (Status, Höhe, Arten, SEPA, Kontoinhaber V+N, Ort, Datum).

### 3c. Export `bigPlusbonusExport.ts`
`buildPlusbonusPdfsForPerson` akzeptiert optional ein `overrides`-Objekt; für Ehegatte/Kinder-PDFs werden Status/Höhe/Arten/Bank aus `eigenePlusbonus` (statt Hauptmitglied) gefüllt. Unterschrift = Nachname aus `eigenePlusbonus.bank.kontoinhaberNachname`.

---

## 4. Getrennter E-Mail-Versand pro Mitglied

### 4a. `SendEmailDialog.tsx`
- Statt EIN Versand: `runAllExports` liefert weiterhin alle PDFs (zentral erzeugt + capture).
- Anhänge werden in **Gruppen** aufgeteilt:
  - Hauptmitglied: alle FamVers-PDFs + Mitglieds-Plusbonus-PDFs + hochgeladene Dokumente
  - Pro Ehegatte/Kind mit eigener Mitgliedschaft: nur dessen Plusbonus-PDF(s) + hochgeladene Dokumente
- UI zeigt jetzt **pro Gruppe** einen Block mit eigenem Betreff/Body (vorausgefüllt aus Templatevars der jeweiligen Person), Empfänger-Feldern (übernehmen den Default), und Anhänge-Liste.
- Senden-Button löst `n` aufeinanderfolgende `supabase.functions.invoke('send-application-email', …)` Aufrufe aus, einer pro Gruppe. Audit-Event pro E-Mail. Bei Fehler in einer Gruppe → andere weiterlaufen, Toast pro Gruppe.

### 4b. Betreff/Body-Variablen
`buildTemplateVars` erweitern → `buildTemplateVarsForPerson(formData, person, bearbeiter)`, mit `{vorname}/{name}/{geburtsdatum}` der jeweiligen Person und `{antragsform}` = "Plusbonus" für eigenständige Sub-Mails, "Familienversicherung + Plusbonus" für Hauptmail.

### 4c. Datei-Zuordnung
PDFs werden anhand des Dateinamens den Personen zugeordnet (`exportBigPlusbonus` benennt PDFs bereits mit Personenname). FamVers-PDFs gehören immer zum Hauptmitglied. Hochgeladene Dokumente werden in jeder Gruppe mitgeschickt.

---

## 5. Memory-Update
`mem/features/big-direkt-integration.md` aktualisieren:
- Signaturquellen pro Antragstyp,
- Kontoinhaber V+N Trennung,
- VIACTIV-Style Beschäftigungs-Logik (Alter ≥15, Ehegatte immer, Kinder altersabhängig),
- pro-Person `eigenePlusbonus` Felder,
- E-Mail pro Mitglied.

---

## Zu ändernde Dateien
- `src/types/form.ts` (BigBankDaten splitten, `eigenePlusbonus` an FamilyMember)
- `src/components/BigPlusbonusSection.tsx` (V+N Kontoinhaber)
- `src/components/SpouseSection.tsx` (Beschäftigung + eigenerPlusbonus-Block)
- `src/components/ChildrenSection.tsx` (Beschäftigung Kind ≥15 + eigenerPlusbonus-Block, alte Checkbox entfernen)
- `src/pages/Index.tsx` (Auto-Sync VIACTIV-Style, Validierung pro eigener Plusbonus)
- `src/utils/bigPlusbonusExport.ts` (Unterschrift aus Kontoinhaber-Nachname, overrides pro Person)
- `src/utils/bigFamversExport.ts` (Mitgliedsunterschrift = mitgliedName, Familienunterschrift = Ehegatte)
- `src/utils/generateSignature.ts` (`resolveBigSignatureLastName` → `kontoinhaberNachname`)
- `src/utils/emailTemplate.ts` (per-Person Vars)
- `src/components/SendEmailDialog.tsx` (Gruppen, Multi-Send)
- `mem/features/big-direkt-integration.md`

## Offene Frage
Bei Hauptmitglied **arbeitslos**: sollen Kinder **<15** trotzdem familienversichert eingetragen werden (im FamVers-PDF)? Ich gehe in diesem Plan davon aus: **ja** (nur ≥15 bekommen eigene Mitgliedschaft).
