

# Novitas BKK: Auto-Sync "bisherige Versicherung besteht weiter bei" mit Hauptmitglied-Krankenkasse

## Problem

Bei Novitas BKK wird das Feld "bisherige Versicherung besteht weiter bei" (unter dem Checkbox "bisherige Versicherung besteht weiter") immer mit "NOVITAS BKK" vorausgefüllt.

**Gewünscht:** Das Feld soll automatisch mit dem Namen der Krankenkasse des Hauptmitglieds (`formData.mitgliedKrankenkasse`) synchronisiert werden.

---

## Betroffene Dateien

### 1. `src/components/FamilyMemberForm.tsx`

Dieses Formular wird für Ehegatte und Kinder verwendet. Das Problem ist in Zeilen 213-221:

**Aktuell:**
```typescript
<FormField
  type="text"
  label="Bei"
  id={`${prefix}-bestehtWeiterBei`}
  value={member.bisherigBestehtWeiterBei || getDefaultKrankenkasseName(selectedKrankenkasse)}
  onChange={(value) => updateMember({ bisherigBestehtWeiterBei: value })}
  placeholder={getDefaultKrankenkasseName(selectedKrankenkasse)}
  required
/>
```

**Problem:** `getDefaultKrankenkasseName(selectedKrankenkasse)` gibt "NOVITAS BKK" zurück, nicht den tatsächlichen Wert aus dem Hauptmitglied-Feld.

### 2. `src/utils/novitasExport.ts`

Die Export-Logik verwendet bereits einen Fallback auf "NOVITAS BKK":

**Ehegatte (Zeilen 176-180):**
```typescript
if (ehegatte.bisherigBestehtWeiter) {
  setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestehtWeiterBei || "NOVITAS BKK");
}
```

**Kinder (Zeilen 264-267):**
```typescript
if (kind.bisherigBestehtWeiter) {
  setTextField(`famv_kv_kind_${i}`, kind.bisherigBestehtWeiterBei || "NOVITAS BKK");
}
```

---

## Lösung

### Schritt 1: FamilyMemberForm.tsx anpassen

Die Komponente muss `mitgliedKrankenkasse` als neuen Prop erhalten und diesen Wert als Default verwenden.

**Interface erweitern:**
```typescript
interface FamilyMemberFormProps {
  member: FamilyMember;
  updateMember: (updates: Partial<FamilyMember>) => void;
  type: 'spouse' | 'child';
  childIndex?: number;
  selectedKrankenkasse?: Krankenkasse;
  mitgliedKrankenkasse?: string;  // NEU
}
```

**Neuer Default-Wert:**
```typescript
// Bei Novitas: mitgliedKrankenkasse als Default, sonst getDefaultKrankenkasseName
const getDefaultBeiValue = (): string => {
  if (selectedKrankenkasse === 'novitas' && mitgliedKrankenkasse) {
    return mitgliedKrankenkasse;
  }
  return getDefaultKrankenkasseName(selectedKrankenkasse);
};
```

**FormField anpassen:**
```typescript
<FormField
  type="text"
  label="Bei"
  id={`${prefix}-bestehtWeiterBei`}
  value={member.bisherigBestehtWeiterBei || getDefaultBeiValue()}
  onChange={(value) => updateMember({ bisherigBestehtWeiterBei: value })}
  placeholder={getDefaultBeiValue()}
  required
/>
```

### Schritt 2: SpouseSection.tsx und ChildrenSection.tsx anpassen

Den neuen Prop `mitgliedKrankenkasse` an FamilyMemberForm übergeben.

### Schritt 3: novitasExport.ts anpassen

Den Fallback von "NOVITAS BKK" auf `formData.mitgliedKrankenkasse` ändern:

**Ehegatte:**
```typescript
if (ehegatte.bisherigBestehtWeiter) {
  setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestehtWeiterBei || formData.mitgliedKrankenkasse);
}
```

**Kinder:**
```typescript
if (kind.bisherigBestehtWeiter) {
  setTextField(`famv_kv_kind_${i}`, kind.bisherigBestehtWeiterBei || formData.mitgliedKrankenkasse);
}
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/FamilyMemberForm.tsx` | Neuer Prop `mitgliedKrankenkasse`, Default-Logik anpassen |
| `src/components/SpouseSection.tsx` | Prop `mitgliedKrankenkasse` übergeben |
| `src/components/ChildrenSection.tsx` | Prop `mitgliedKrankenkasse` übergeben |
| `src/utils/novitasExport.ts` | Fallback auf `formData.mitgliedKrankenkasse` statt "NOVITAS BKK" |

---

## Ergebnis

| Vorher | Nachher |
|--------|---------|
| "NOVITAS BKK" (hardcoded) | Dynamisch: Wert aus "Name der Krankenkasse" des Hauptmitglieds |
| Export: Fallback "NOVITAS BKK" | Export: Fallback `formData.mitgliedKrankenkasse` |

