

# Novitas BKK: KVNR Fix und Versichertennummer entfernen

## Problem 1: KV-Nummer wird nicht ins PDF geschrieben

Die aktuelle `setAllTextFields` Funktion verwendet `form.getFields()` und versucht Felder mit demselben Namen zu finden. In pdf-lib haben Felder mit demselben Namen jedoch oft ein internes Suffix (z.B. `KVNR.#0`, `KVNR.#1`). Die Iteration findet daher nicht alle Instanzen.

### Lösung: Direktes Iterieren über alle Felder und Substring-Match

```typescript
// In createPDFHelpers
const setAllTextFields = (fieldNamePattern: string, value: string) => {
  if (!value) return;
  try {
    const allFields = form.getFields();
    allFields.forEach((field: any) => {
      const name = field.getName();
      // Match exakt oder mit Suffix (z.B. KVNR. oder KVNR.#0)
      if (name === fieldNamePattern || name.startsWith(fieldNamePattern)) {
        try {
          const textField = form.getTextField(name);
          textField.setText(value);
        } catch {}
      }
    });
  } catch (e) {
    // Fallback
    setTextField(fieldNamePattern, value);
  }
};
```

---

## Problem 2: Versichertennummer für Kinder/Ehegatte sind nicht notwendig

Im Novitas PDF gibt es keine EditBox für die Versichertennummer der Kinder oder des Ehegatten. Diese Felder müssen:

1. **In der UI für Novitas ausgeblendet werden** (FamilyMemberForm.tsx)
2. **Im Export nicht mehr geschrieben werden** (novitasExport.ts - bereits korrekt, da kein Feld dafür existiert)
3. **Keine Validierung beim Export blockieren** (Index.tsx prüft Versichertennummer nicht für Novitas)

---

## Änderungen

### 1. novitasExport.ts - KVNR Fix

**Zeilen 48-65: setAllTextFields verbessern**

```typescript
const setAllTextFields = (fieldNamePattern: string, value: string) => {
  if (!value) return;
  try {
    const allFields = form.getFields();
    allFields.forEach((field: any) => {
      const name = field.getName();
      // Match exakt oder mit Suffix (z.B. KVNR. oder KVNR.#0)
      if (name === fieldNamePattern || name.startsWith(fieldNamePattern)) {
        try {
          const textField = form.getTextField(name);
          textField.setText(value);
        } catch {}
      }
    });
  } catch (e) {
    setTextField(fieldNamePattern, value);
  }
};
```

**Zusätzlich: Explizit beide KVNR-Feldnamen versuchen**

```typescript
// In fillBasicFields
setAllTextFields("KVNR.", formData.mitgliedKvNummer);
setAllTextFields("KVNR", formData.mitgliedKvNummer);  // Fallback ohne Punkt
```

**Zeile 154-155: Versichertennummer des Ehepartners ENTFERNEN**

```typescript
// ENTFERNEN - kein PDF-Feld dafür:
// setTextField("bw_strasse_partner", ehegatte.versichertennummer);
```

---

### 2. FamilyMemberForm.tsx - Versichertennummer bei Novitas ausblenden

**Zeilen 148-158: Conditional Rendering**

```tsx
{/* Versichertennummer - bei Novitas nicht anzeigen (kein PDF-Feld) */}
{selectedKrankenkasse !== 'novitas' && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      type="text"
      label="Versichertennummer"
      id={`${prefix}-versichertennummer`}
      value={member.versichertennummer}
      onChange={(value) => updateMember({ versichertennummer: value })}
      placeholder="Versichertennummer"
      required
      validate={validateVersichertennummer}
    />
    {type === 'child' && (
      <FormField
        type="select"
        label="Verwandtschaftsverhältnis"
        ...
      />
    )}
  </div>
)}

{/* Bei Novitas nur das Verwandtschaftsverhältnis anzeigen */}
{selectedKrankenkasse === 'novitas' && type === 'child' && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      type="select"
      label="Verwandtschaftsverhältnis"
      id={`${prefix}-verwandtschaft`}
      value={member.verwandtschaft}
      onChange={(value) => updateMember({ verwandtschaft: value as FamilyMember['verwandtschaft'] })}
      options={verwandtschaftOptions}
      required
      validate={validateSelect}
    />
  </div>
)}
```

---

## Dateien-Übersicht

| Datei | Änderung |
|-------|----------|
| `src/utils/novitasExport.ts` | KVNR-Fix mit verbesserter Feldsuche, Versichertennummer-Export entfernen |
| `src/components/FamilyMemberForm.tsx` | Versichertennummer bei Novitas ausblenden |

---

## Zusammenfassung

| Problem | Ursache | Lösung |
|---------|---------|--------|
| KVNR nicht geschrieben | pdf-lib findet nur ein Feld bei doppelten Namen | Substring-Match für alle Felder |
| Versichertennummer Kind/Ehegatte | Kein PDF-Feld vorhanden | UI-Feld bei Novitas ausblenden |
| Export-Hemmung | Pflichtfeld ohne PDF-Entsprechung | Validierung nicht mehr blockiert |

