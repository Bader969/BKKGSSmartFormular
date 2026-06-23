## Änderungen am VIACTIV Bonus-Export ("Wegbegleiter")

Nur betroffen: `src/utils/viactivBonusExport.ts` (kein anderes Kassenformular, keine UI-Änderung).

### 1. Unterschrift immer vom Kontoinhaber

Aktuell wird auf den Bonus-PDFs die normale Mitglieds- bzw. Familien-Unterschrift verwendet (Nachname Mitglied / Ehegatte / ältestes Kind ≥ 16).

Neu: Auf **allen** VIACTIV-Bonus-PDFs (Hauptmitglied, Ehegatte, Kinder) wird die Unterschrift aus dem Nachnamen des **Kontoinhabers** (`formData.viactivBonusKontoinhaber`) generiert.

- Nachname = letztes Wort des Felds `viactivBonusKontoinhaber` (z. B. "Max Mustermann" → "Mustermann"; "Anna von der Heide" → "Heide").
- Mit `generateSignatureDataUrl(lastName)` als Caveat-Bild rendern.
- Wenn das Feld leer ist → keine Unterschrift einfügen (wie bisher bei leerer Signatur).
- Diese eine Unterschrift wird für jedes erzeugte Bonus-PDF (Mitglied, Ehegatte, Kinder ≥/< 15, Kinder mit eigener Mitgliedschaft) verwendet — egal wer auf dem Blatt steht.

Andere Exporte (Hauptantrag, Familienversicherung, Novitas, DAK, BIG, BKK) bleiben unverändert.

### 2. Keine Familien-Bonus-PDFs ohne Familienversicherung

Aktuelle Bedingung pro Ehegatte/Kind:  
`if (formData.viactivFamilienangehoerigeMitversichern && ...)`

Anpassung, damit die Regel explizit der Nutzervorgabe entspricht:

- **Ehegatte**: PDF nur erzeugen, wenn `viactivFamilienangehoerigeMitversichern === true` **und** der Ehegatte tatsächlich familienversichert ist (also **nicht** `ehegatte.eigeneMitgliedschaft`). Hat der Ehegatte eine eigene Mitgliedschaft, wird für ihn kein Bonus-PDF erstellt.
- **Kinder**: 
  - Kind mit eigener Mitgliedschaft → weiterhin Erwachsenen-Bonus (unverändert, da hier eigene Versicherung gewünscht ist — bestätigt durch vorhandene Logik).
  - Familienversicherte Kinder → nur wenn `viactivFamilienangehoerigeMitversichern === true`.
- Wenn weder familienversicherter Ehegatte noch Kinder vorhanden sind, wird **nur** das Hauptmitglieds-Bonus-PDF erstellt.

### Technische Details

Neue Hilfsfunktion lokal in `viactivBonusExport.ts`:

```ts
const getKontoinhaberSignature = async (formData: FormData): Promise<string> => {
  const full = (formData.viactivBonusKontoinhaber ?? '').trim();
  if (!full) return '';
  const lastName = full.split(/\s+/).pop() ?? '';
  return lastName ? await generateSignatureDataUrl(lastName) : '';
};
```

Aufruf einmalig in `exportViactivBonusPDFs` nach `ensureSignatureFontReady()`; das Ergebnis ersetzt sowohl `formData.unterschrift` als auch `formData.unterschriftFamilie` für diesen Export (lokale Kopie, kein Seiteneffekt nach außen).

Bedingungen werden in `exportViactivBonusPDFs` angepasst (Ehegatte-Block: zusätzliche `!formData.ehegatte.eigeneMitgliedschaft`-Prüfung — sofern das Feld existiert; sonst nur Anwesenheit des Familien-Flags).

### Nicht betroffen
- UI / Formularfelder
- Validierung
- Schriftart, Größe, Position der Unterschrift
- Alle anderen PDF-Exporte
