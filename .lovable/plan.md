
# Novitas BKK UI-Anpassungen - Korrigierter Implementierungsplan

## Zusammenfassung der Klarstellungen

Der Benutzer hat präzisiert:

1. **"Familienversichert" Checkbox (Zeilen 192-200 in FamilyMemberForm.tsx):**
   - **Für Kinder:** Checkbox entfernen, da Kinder **IMMER** familienversichert sind (statisch, hardcoded im Export)
   - **Für Ehegatte:** Checkbox entfernen, da die Versicherungsart bereits über RadioButtons in SpouseSection.tsx (Zeilen 144-179) ausgewählt wird

2. **"Bisherige Versicherung besteht weiter bei" Feld:**
   - Dynamisch vorausfüllen basierend auf ausgewählter Krankenkasse:
     - `'novitas'` → "NOVITAS BKK"
     - `'bkk_gs'` → "BKK GS"
     - `'viactiv'` → "VIACTIV"

3. **Geburtsland und Staatsangehörigkeit:**
   - Als Dropdown-Listen (nicht Textfelder)
   - Vollständige Namen ins PDF schreiben (nicht Codes)

---

## Dateien-Änderungen

### 1. FamilyMemberForm.tsx

**Änderung 1: Props erweitern**
```typescript
interface FamilyMemberFormProps {
  member: FamilyMember;
  updateMember: (updates: Partial<FamilyMember>) => void;
  type: 'spouse' | 'child';
  childIndex?: number;
  selectedKrankenkasse?: Krankenkasse; // NEU
}
```

**Änderung 2: "Familienversichert" Checkbox entfernen (Zeilen 192-200)**

Diese Checkbox wird komplett entfernt:
```tsx
// ENTFERNEN:
<div className="mt-3">
  <FormField
    type="checkbox"
    label="Familienversichert"
    id={`${prefix}-familienversichert`}
    checked={member.familienversichert !== false}
    onChange={(checked) => updateMember({ familienversichert: checked })}
  />
</div>
```

**Änderung 3: Dynamischer Platzhalter für "Bei" Feld**
```typescript
// Hilfsfunktion
const getDefaultKrankenkasseName = (kasse?: Krankenkasse): string => {
  switch (kasse) {
    case 'novitas': return 'NOVITAS BKK';
    case 'viactiv': return 'VIACTIV';
    case 'bkk_gs': 
    default: return 'BKK GS';
  }
};

// Im Feld "Bei"
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

**Änderung 4: Geburtsland als Dropdown (für Kinder, Zeilen 111-120)**
```tsx
// Import hinzufügen
import { COUNTRY_OPTIONS, NATIONALITY_OPTIONS } from '@/utils/countries';

// Geburtsland von text zu select ändern
<FormField
  type="select"
  label="Geburtsland"
  id={`${prefix}-geburtsland`}
  value={member.geburtsland}
  onChange={(value) => updateMember({ geburtsland: value })}
  options={COUNTRY_OPTIONS.map(c => ({ value: c.code, label: c.name }))}
  placeholder="Land auswählen"
  required
  validate={validateSelect}
/>
```

---

### 2. SpouseSection.tsx

**Änderung 1: Props erweitern**
```typescript
interface SpouseSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
  selectedKrankenkasse?: Krankenkasse; // NEU für Prop-Durchreichung
}
```

**Änderung 2: selectedKrankenkasse an FamilyMemberForm durchreichen**
```tsx
<FamilyMemberForm
  member={formData.ehegatte}
  updateMember={updateEhegatte}
  type="spouse"
  selectedKrankenkasse={formData.selectedKrankenkasse}
/>
```

**Änderung 3: Geburtsland als Dropdown (Zeilen 79-88)**
```tsx
// Import hinzufügen
import { COUNTRY_OPTIONS, NATIONALITY_OPTIONS } from '@/utils/countries';

// Geburtsland von text zu select ändern
<FormField
  type="select"
  label="Geburtsland"
  id="ehegatte-geburtsland"
  value={formData.ehegatte.geburtsland}
  onChange={(value) => updateEhegatte({ geburtsland: value })}
  options={COUNTRY_OPTIONS.map(c => ({ value: c.code, label: c.name }))}
  placeholder="Land auswählen"
  required
  validate={validateSelect}
/>
```

**Änderung 4: Staatsangehörigkeit als Dropdown (Zeilen 89-98)**
```tsx
<FormField
  type="select"
  label="Staatsangehörigkeit"
  id="ehegatte-staatsangehoerigkeit"
  value={formData.ehegatte.staatsangehoerigkeit}
  onChange={(value) => updateEhegatte({ staatsangehoerigkeit: value })}
  options={NATIONALITY_OPTIONS.map(c => ({ value: c.code, label: c.name }))}
  placeholder="Staatsangehörigkeit auswählen"
  required
  validate={validateSelect}
/>
```

---

### 3. ChildrenSection.tsx

**Änderung: selectedKrankenkasse an FamilyMemberForm durchreichen**

```tsx
<FamilyMemberForm
  member={kind}
  updateMember={(updates) => updateKind(index, updates)}
  type="child"
  childIndex={index}
  selectedKrankenkasse={formData.selectedKrankenkasse}
/>
```

---

### 4. novitasExport.ts

**Änderung: Vollständige Ländernamen ins PDF schreiben**

```typescript
// Import hinzufügen
import { getCountryName, getNationalityName } from './countries';

// Beim Füllen der Ehegatte-Felder:
setTextField("fna_PartnerGeburtsland", getCountryName(ehegatte.geburtsland));
setTextField("fna_PartnerStaatsangehoerigkeit", getNationalityName(ehegatte.staatsangehoerigkeit));

// Beim Füllen der Kinder-Felder:
setTextField(`geburtsland_kind_${i}`, getCountryName(kind.geburtsland));
setTextField(`staatsangehoerigkeit_kind_${i}`, getNationalityName(kind.staatsangehoerigkeit));
```

---

## Export-Logik Klarstellung

### Kinder: IMMER Familienversicherung (statisch)
```typescript
// Im Export bleibt hardcoded:
setCheckbox(`angabe_eigene_kv_kind_${i}.GesetzlichFAMI`, true);
```

### Ehegatte: Basierend auf RadioButton-Auswahl
```typescript
// Übernimmt den Wert von ehegatte.bisherigArt (RadioButtons in SpouseSection)
setCheckbox("fna_PartnerVersArt.GesetzlichMitglied", ehegatte.bisherigArt === 'mitgliedschaft');
setCheckbox("fna_PartnerVersArt.GesetzlichFAMI", ehegatte.bisherigArt === 'familienversicherung');
setCheckbox("fna_PartnerVersArt.NichtGesetzlich", ehegatte.bisherigArt === 'nicht_gesetzlich');
```

---

## Übersicht der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/FamilyMemberForm.tsx` | Props erweitern, Checkbox entfernen, dynamischer Default, Geburtsland-Dropdown |
| `src/components/SpouseSection.tsx` | Props durchreichen, Dropdowns für Geburtsland/Staatsangehörigkeit |
| `src/components/ChildrenSection.tsx` | Props durchreichen |
| `src/utils/novitasExport.ts` | Ländernamen-Konvertierung beim PDF-Export |

---

## Zusammenfassung der Logik

| Element | Kinder | Ehegatte |
|---------|--------|----------|
| Familienversichert Checkbox | Entfernt (immer true im Export) | Entfernt (RadioButtons in SpouseSection) |
| Versicherungsart | Hardcoded: Familienversicherung | RadioButtons: Mitgliedschaft/Familienvers./Nicht gesetzlich |
| "Besteht weiter bei" | Dynamisch vorausgefüllt | Dynamisch vorausgefüllt |
| Geburtsland | Dropdown mit Ländernamen | Dropdown mit Ländernamen |
| Staatsangehörigkeit | Dropdown mit Nationalitäten | Dropdown mit Nationalitäten |
| PDF-Export Geburtsland | Vollständiger Name (z.B. "Deutschland") | Vollständiger Name |
| PDF-Export Staatsangehörigkeit | Vollständiger Name (z.B. "Deutsch") | Vollständiger Name |
