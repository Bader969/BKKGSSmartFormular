

# Novitas BKK Export & UI Korrekturen - Implementierungsplan

## Zusammenfassung der gefundenen Probleme

Nach Analyse der CSV-Datei und des Export-Codes wurden folgende Probleme identifiziert:

---

## 1. UI-Änderung: Nicht benötigte Felder für Mitglied entfernen

**Problem:** Die Felder Adresse (Straße, Hausnummer, PLZ, Ort), Geburtsdatum, Geburtsort und Geburtsland sind für Novitas Mitglied nicht erforderlich.

**Lösung:** In `MemberSection.tsx` diese Felder bei Novitas ausblenden (conditional rendering basierend auf `selectedKrankenkasse`).

---

## 2. KV-Nummer des Mitglieds nicht eingetragen

**Problem im Code:** Der `setTextField("KVNR.", ...)` funktioniert, aber es gibt **zwei** `KVNR.`-Felder im PDF (Seite 2 + Seite 3). pdf-lib erkennt nur eines.

**Aus der CSV:**
- Zeile 3: `KVNR.` auf Seite 2 (Position 380, 62)
- Zeile 80: `KVNR.` auf Seite 3 (Position 82, 103)

**Lösung:** Das Feld existiert zweimal mit dem gleichen Namen. pdf-lib muss beide Instanzen befüllen. Wir müssen die Felder direkt mit `form.getFields()` iterieren und alle `KVNR.`-Felder setzen.

---

## 3. Familienstand nicht angekreuzt

**Problem:** Die `setCheckbox()`-Funktion verwendet `form.getCheckBox()`, aber die Familienstand-Felder sind **RadioButtons**, keine Checkboxen!

**Aus der CSV:**
```
"fna_Famstand.L","fna_Famstand.L","RadioButton"
"fna_Famstand.V","fna_Famstand.V","RadioButton"
```

**Lösung:** Eine `setRadioButton()`-Funktion hinzufügen, die RadioButtons korrekt setzt.

---

## 4. "Anlass für die Aufnahme" (abgabegrund.B) nicht angekreuzt

**Gleiche Problem wie #3:** `abgabegrund.B` ist ein **RadioButton**, nicht eine Checkbox.

```csv
"abgabegrund.B","abgabegrund.B","RadioButton"
```

---

## 5. Geschlecht der Kinder nicht angekreuzt

**Gleiche Problem:** Die Geschlechtsfelder sind **RadioButtons**:
```csv
"geschlecht_kind_1.m","geschlecht_kind_1.m","RadioButton"
"geschlecht_kind_1.w","geschlecht_kind_1.w","RadioButton"
```

---

## 6. Verwandtschaftsverhältnis nicht angekreuzt

**Gleiche Problem:** Auch RadioButtons:
```csv
"fna_KindVerwandt_1.L","fna_KindVerwandt_1.L","RadioButton"
```

---

## 7. "bw_strasse_kind" sollte NICHT Versichertennummer enthalten

**Problem im Code (Zeile 175):**
```typescript
setTextField(`bw_strasse_kind_${i}`, kind.versichertennummer);
```

**Korrektur:** Das Feld `bw_strasse_kind_*` ist für **"ggf. vom Mitglied abweichende Anschrift"** - Straße, nicht Versichertennummer! Dieses Feld sollte leer bleiben oder die tatsächliche abweichende Adresse enthalten.

---

## 8. PDF Flattening (PDF wird "starr")

**Problem:** Zeile 283 in novitasExport.ts:
```typescript
form.flatten();
```

**Lösung:** `form.flatten()` entfernen, damit das PDF bearbeitbar bleibt.

---

## Technische Korrektur: RadioButton vs Checkbox

pdf-lib behandelt RadioButtons anders als Checkboxen:
- **Checkbox:** `form.getCheckBox(name).check()`
- **RadioButton:** `form.getRadioGroup(name).select(option)`

Für RadioButtons mit dem Format `feldname.option` (z.B. `fna_Famstand.L`):
- Die RadioGroup heißt `fna_Famstand`
- Die Option heißt `L`

---

## Änderungen in novitasExport.ts

### Neue Hilfsfunktion für RadioButtons

```typescript
const setRadioButton = (groupName: string, option: string) => {
  try {
    const radioGroup = form.getRadioGroup(groupName);
    if (radioGroup && option) {
      radioGroup.select(option);
    }
  } catch (e) {
    // Fallback: try as individual button
    try {
      const buttonName = `${groupName}.${option}`;
      const button = form.getButton(buttonName);
      // ...
    } catch {}
  }
};
```

### Korrekte Feld-Aufrufe

| Feld | Falsch (aktuell) | Richtig |
|------|------------------|---------|
| Familienstand | `setCheckbox("fna_Famstand.L", true)` | `setRadioButton("fna_Famstand", "L")` |
| Abgabegrund | `setCheckbox("abgabegrund.B", true)` | `setRadioButton("abgabegrund", "B")` |
| Geschlecht Partner | `setCheckbox("fna_PartnerGeschlecht.m", true)` | `setRadioButton("fna_PartnerGeschlecht", "m")` |
| Geschlecht Kind | `setCheckbox("geschlecht_kind_1.m", true)` | `setRadioButton("geschlecht_kind_1", "m")` |
| Verwandtschaft | `setCheckbox("fna_KindVerwandt_1.L", true)` | `setRadioButton("fna_KindVerwandt_1", "L")` |
| Versicherungsart | `setCheckbox("fna_PartnerVersArt.GesetzlichMitglied", true)` | `setRadioButton("fna_PartnerVersArt", "GesetzlichMitglied")` |
| Kind Vers.Art | `setCheckbox("angabe_eigene_kv_kind_1.GesetzlichFAMI", true)` | `setRadioButton("angabe_eigene_kv_kind_1", "GesetzlichFAMI")` |

### KVNR auf beiden Seiten setzen

```typescript
// Setze KVNR auf allen Seiten (PDF hat 2 Felder mit gleichem Namen)
const allFields = form.getFields();
allFields.forEach(field => {
  if (field.getName() === 'KVNR.' || field.getName() === 'KVNR') {
    try {
      const textField = form.getTextField(field.getName());
      textField.setText(formData.mitgliedKvNummer);
    } catch {}
  }
});
```

### bw_strasse_kind korrigieren

```typescript
// NICHT die Versichertennummer, sondern leer lassen oder abweichende Adresse
// setTextField(`bw_strasse_kind_${i}`, kind.versichertennummer); // ENTFERNEN

// Falls abweichende Anschrift vorhanden, diese eintragen
if (kind.abweichendeAnschrift) {
  setTextField(`bw_strasse_kind_${i}`, kind.abweichendeAnschrift);
}
```

### form.flatten() entfernen

```typescript
// ENTFERNEN:
// form.flatten();
```

---

## UI-Änderung in MemberSection.tsx

Für Novitas sind Adresse und Geburtsort/land nicht notwendig. Lösung: Props erweitern und conditional rendering.

```tsx
interface MemberSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
  selectedKrankenkasse?: Krankenkasse;
}

// Conditional rendering:
{formData.selectedKrankenkasse !== 'novitas' && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* Geburtsdatum, Geburtsort, Geburtsland Felder */}
  </div>
)}

{formData.selectedKrankenkasse !== 'novitas' && (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
    {/* Straße, Hausnummer, PLZ, Ort Felder */}
  </div>
)}
```

---

## Dateien-Übersicht

| Datei | Änderung |
|-------|----------|
| `src/utils/novitasExport.ts` | RadioButton-Funktion, KVNR-Fix, bw_strasse-Fix, flatten entfernen |
| `src/components/MemberSection.tsx` | Nicht benötigte Felder bei Novitas ausblenden |

---

## Zusammenfassung der Fixes

| Problem | Ursache | Lösung |
|---------|---------|--------|
| KV-Nummer nicht eingetragen | PDF hat 2 KVNR-Felder | Alle KVNR-Felder iterieren und setzen |
| Familienstand nicht angekreuzt | RadioButton mit Checkbox-Methode gesetzt | `setRadioButton()` verwenden |
| Anlass nicht angekreuzt | RadioButton mit Checkbox-Methode gesetzt | `setRadioButton()` verwenden |
| Geschlecht Kinder nicht angekreuzt | RadioButton mit Checkbox-Methode gesetzt | `setRadioButton()` verwenden |
| Verwandtschaft nicht angekreuzt | RadioButton mit Checkbox-Methode gesetzt | `setRadioButton()` verwenden |
| bw_strasse_kind falsch befüllt | Versichertennummer statt Adresse | Feld leer lassen / abweichende Adresse |
| PDF starr/flattened | `form.flatten()` aufgerufen | Zeile entfernen |
| UI: Unnötige Felder | Alle Felder angezeigt | Bei Novitas Adress-/Geburtsfelder ausblenden |

