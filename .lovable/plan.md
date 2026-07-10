## VIACTIV — Separate E-Mails, FV-Umbenennung, VIACTIV-Betreff & fehlender WB für Ehegatten

### 1) Fehlender Wegbegleiter (Bonus-PDF) für Ehegatten mit eigener Mitgliedschaft

**Ursache** in `src/utils/viactivBonusExport.ts` → Ehegatten-Block:
Die Bedingung lautet `!formData.ehegatte.eigeneMitgliedschaft`. Wenn der Ehegatte eine eigene Mitgliedschaft hat (Fall im Screenshot: Alhamad, Mahasen), wird **kein** Bonus-PDF (WB) erzeugt. Für Kinder mit `eigeneMitgliedschaft` existiert die Logik bereits (→ Erwachsenen-Bonus).

**Fix:** Ehegatten-Block analog zu Kindern behandeln:
- Wenn `ehegatte.eigeneMitgliedschaft` (bzw. `bisherigArt === 'mitgliedschaft'`) → **immer** Erwachsenen-Bonus-PDF.
- Sonst wie bisher: unter 15 → Kinder-Bonus, ab 15 → Erwachsenen-Bonus.
- Bedingung `viactivFamilienangehoerigeMitversichern` bleibt bestehen.

### 2) FV-Dateiname: Erstellungsdatum → Geburtsdatum des Hauptantragstellers

**Aktuell** in `src/utils/viactivFamilyExport.ts`:
```
Viactiv_Nachname, Vorname_Familienversicherung_<heutigesDatum>.pdf
```
**Neu:**
```
Viactiv_Nachname, Vorname_Familienversicherung_<Geburtsdatum Hauptmitglied im Format TT.MM.JJJJ>.pdf
```
Umsetzung: `datumForFilename` durch `formatInputDate(formData.mitgliedGeburtsdatum)` ersetzen (Fallback auf leer/`Geburtsdatum`, falls nicht gesetzt). `_Teil1/_Teil2`-Suffix bleibt bei >3 Kindern.

### 3) Separate E-Mail-Gruppen bei VIACTIV pro eigener Mitgliedschaft

`src/components/SendEmailDialog.tsx` erzeugt für VIACTIV bereits eigene Gruppen für Ehegatte/Kind mit eigener Mitgliedschaft (Block „VIACTIV Variante B"). WB und BE folgen automatisch dem Namens-Match; FV bleibt beim Hauptmitglied. Keine strukturelle Änderung, nur Betreff/Body-Overrides (siehe Punkt 4).

### 4) VIACTIV-spezifische Betreff- und Body-Regeln

Aktuell nutzt jede Gruppe das globale Template.

Für VIACTIV wird pro Gruppe (Hauptmitglied und Variante-B-Personen) **hart** überschrieben:

- **Betreff:** `{name}, {vorname}, geb. {geburtsdatum}` → Beispiel: `Hmedi, Ali, geb. 01.01.2011`
- **Body:**
  ```
  Sehr geehrte Damen und Herren,

  anbei finden Sie den/die Antrag/Anträge für {vorname} {name}, geboren am {geburtsdatum}.

  Angefügt: {antragsform} (Beitrittserklärung und Wegbegleiter und ggf. Familienversicherung){foto} und dazu benötigte Dokumente.

  Mit freundlichen Grüßen

  BlitzVox Team
  ```

Umsetzung in `SendEmailDialog.tsx`:
- Neue lokale Konstanten `VIACTIV_SUBJECT_TEMPLATE` und `VIACTIV_BODY_TEMPLATE`.
- Beim Bauen der Gruppen: bei `selectedKrankenkasse === 'viactiv'` diese Templates statt `subjTpl` / `body` verwenden.
- Body-State wird beim Öffnen für VIACTIV auf `VIACTIV_BODY_TEMPLATE` gesetzt; der User kann ihn im Textfeld weiterhin anpassen.

### Betroffene Dateien
- `src/utils/viactivBonusExport.ts` — Ehegatten-Zweig um `eigeneMitgliedschaft`-Fall erweitern.
- `src/utils/viactivFamilyExport.ts` — FV-Dateiname auf Geburtsdatum des Hauptantragstellers umstellen.
- `src/components/SendEmailDialog.tsx` — VIACTIV-spezifische Betreff-/Body-Templates.

### Nicht geändert
- Gruppen-Aufteilung für VIACTIV (Variante B existiert bereits).
- BIG, DAK, Novitas, BKK GS Templates.
- WhatsApp-Versand-Logik.
