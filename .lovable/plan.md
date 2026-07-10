## Ziel
Die "Name der Krankenkasse" des Hauptmitglieds bleibt die Quelle, die überall automatisch übernommen wird. Sobald jedoch bei Ehegatte oder einem Kind ein abweichender Wert manuell eingetragen wurde, darf ein späteres Ändern der Krankenkasse beim Hauptmitglied diesen individuellen Wert **nicht** mehr überschreiben. Änderungen an Ehegatten-/Kinder-Feldern dürfen außerdem **nicht** rückwärts auf das Hauptmitglied wirken.

## Analyse (aktuelles Verhalten)
- `MemberSection.tsx` (Zeile 183–186): Beim Ändern von `mitgliedKrankenkasse` wird **immer** auch `ehegatteKrankenkasse` überschrieben → zerstört individuelle Ehegatten-Krankenkasse.
- `SpouseSection.tsx` (Zeile 120–123): Beim Ändern von `ehegatteKrankenkasse` wird **rückwärts** auch `mitgliedKrankenkasse` überschrieben → Änderung wirkt „überall".
- Kinder-Felder (`ChildrenSection.tsx` Z. 134, `ViactivSection.tsx` Z. 345/482/674, `FamilyMemberForm.tsx` Z. 226–229): benutzen bereits das Fallback-Muster `kind.bisherigBestandBei || formData.mitgliedKrankenkasse`. Ein individuell eingetragener Wert bleibt technisch erhalten, aber die Anzeige „synchronisiert" sich visuell — das ist gewünscht.

## Änderungen

### 1) `src/components/MemberSection.tsx`
Der `onChange`-Handler für `mitgliedKrankenkasse` überschreibt `ehegatteKrankenkasse` nur noch, wenn dort noch kein eigener Wert steht bzw. der bisherige Wert identisch mit dem alten `mitgliedKrankenkasse` war (also noch nie manuell abgewandelt).

```ts
onChange={(value) => {
  const prev = formData.mitgliedKrankenkasse ?? '';
  const spouseUntouched =
    !formData.ehegatteKrankenkasse || formData.ehegatteKrankenkasse === prev;
  updateFormData({
    mitgliedKrankenkasse: value,
    ...(spouseUntouched ? { ehegatteKrankenkasse: value } : {}),
  });
}}
```

### 2) `src/components/SpouseSection.tsx`
Rückwärts-Sync entfernen. `ehegatteKrankenkasse` schreibt nur noch sich selbst — das Hauptmitglied bleibt unangetastet.

```ts
onChange={(value) => updateFormData({ ehegatteKrankenkasse: value })}
```

### 3) Kinder- und Viactiv-Felder
Keine Änderung nötig. Das bestehende Fallback-Muster `kind.bisherigBestandBei || formData.mitgliedKrankenkasse` erfüllt die Anforderung bereits:
- Solange nichts eingetragen wurde, wird die Krankenkasse des Hauptmitglieds angezeigt und exportiert.
- Sobald man einen abweichenden Wert einträgt, bleibt dieser dauerhaft — spätere Änderungen am Hauptmitglied wirken sich auf dieses Kind nicht mehr aus.

Analog für die Ehegatten-Felder `bisherigBestandBei` / `bisherigBestehtWeiterBei` in `ViactivSection.tsx` und `FamilyMemberForm.tsx` (bereits Fallback, kein Overwrite).

## Nicht betroffen
- Import-Logik (`JsonImportDialog`, `FreitextImportDialog`, `krankenkassenMapping.ts`): initiales Vorbelegen bleibt wie gehabt.
- PDF-Exporte (`viactivExport.ts`, `dakExport.ts`, `novitasExport.ts`, `bigFamversExport.ts`, `viactivFamilyExport.ts`, `pdfExport.ts`): nutzen bereits person-spezifische Werte mit Fallback auf `mitgliedKrankenkasse`.
- Provider-Auswahl (`selectedKrankenkasse`) und Antragsform-Logik.

## Betroffene Dateien
- `src/components/MemberSection.tsx`
- `src/components/SpouseSection.tsx`
