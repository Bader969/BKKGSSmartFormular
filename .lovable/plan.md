

# Dynamischer Header & Krankenkasse-zuerst-Auswahl

## Ziel

1. **Krankenkasse zuerst auswählen** - Formularfelder werden erst nach der Auswahl angezeigt
2. **Dynamischer Header-Titel** - Die Überschrift passt sich der gewählten Krankenkasse an

---

## Aktueller Zustand

- Header zeigt immer "BKK GS-Smart Formular"
- Alle Formularfelder werden sofort angezeigt
- Standard-Krankenkasse ist `bkk_gs`

---

## Geplante Änderungen

### 1. Dynamischer Header-Titel

Der Titel im Header wird basierend auf `selectedKrankenkasse` dynamisch:

| Krankenkasse | Titel |
|--------------|-------|
| `viactiv` | VIACTIV Formular |
| `novitas` | Novitas BKK Formular |
| `dak` | DAK Formular |
| `bkk_gs` | BKK GS Formular |
| (keine Auswahl) | Smart Formular |

### 2. Krankenkasse-zuerst-Logik

- Neuer State: `selectedKrankenkasse` startet mit leerem String (`''`)
- Formularfelder werden **nur angezeigt**, wenn eine Krankenkasse gewählt wurde
- Krankenkassen-Auswahl bleibt als erstes Element sichtbar

### 3. BKK GS verstecken

- BKK GS Option wird aus der Auswahlliste auskommentiert
- Kann später einfach reaktiviert werden

---

## Technische Änderungen

### `src/types/form.ts`

**Zeile 72 - Typ erweitern:**
```typescript
export type Krankenkasse = 'bkk_gs' | 'viactiv' | 'novitas' | 'dak' | '';
```

**Zeile 74-79 - BKK GS auskommentieren:**
```typescript
export const KRANKENKASSEN_OPTIONS = [
  // { value: 'bkk_gs' as Krankenkasse, label: 'BKK GILDEMEISTER SEIDENSTICK' }, // Temporär versteckt
  { value: 'viactiv' as Krankenkasse, label: 'VIACTIV Krankenkasse' },
  { value: 'novitas' as Krankenkasse, label: 'Novitas BKK' },
  { value: 'dak' as Krankenkasse, label: 'DAK Familienversicherung' },
] as const;
```

**Zeile 286 - Standard auf leer:**
```typescript
selectedKrankenkasse: '',
```

---

### `src/pages/Index.tsx`

**1. Helper-Funktion für Header-Titel hinzufügen (nach Zeile 68):**
```typescript
const getHeaderTitle = () => {
  switch (formData.selectedKrankenkasse) {
    case 'viactiv': return 'VIACTIV Formular';
    case 'novitas': return 'Novitas BKK Formular';
    case 'dak': return 'DAK Formular';
    case 'bkk_gs': return 'BKK GS Formular';
    default: return 'Smart Formular';
  }
};

const getHeaderSubtitle = () => {
  switch (formData.selectedKrankenkasse) {
    case 'viactiv': return 'VIACTIV Krankenkasse - Beitrittserklärung';
    case 'novitas': return 'Novitas BKK - Familienversicherung';
    case 'dak': return 'DAK - Familienversicherung';
    case 'bkk_gs': return 'BKK GILDEMEISTER SEIDENSTICK - Online-Formular';
    default: return 'Bitte wählen Sie eine Krankenkasse aus';
  }
};
```

**2. Header-Titel dynamisch machen (Zeilen 271-283):**
```typescript
<h1 className="text-2xl md:text-3xl font-bold">
  {getHeaderTitle()}
</h1>
...
<p className="text-primary-foreground/80 text-sm md:text-base">
  {getHeaderSubtitle()}
</p>
```

**3. Formularfelder nur bei Auswahl anzeigen (alle Sektionen nach Krankenkassen-Auswahl):**

Alle Formular-Sektionen (MemberSection, SpouseSection, ChildrenSection, etc.) werden in eine Bedingung gepackt:

```typescript
{formData.selectedKrankenkasse && (
  <>
    <MemberSection ... />
    {/* ... weitere Sektionen ... */}
    <SignatureSection ... />
    {/* Export Button */}
  </>
)}
```

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/types/form.ts` | Typ erweitern, BKK GS auskommentieren, Standard auf `''` |
| `src/pages/Index.tsx` | Helper-Funktionen, dynamischer Header, bedingte Anzeige |

---

## Ergebnis

1. Beim Öffnen: Nur Krankenkassen-Auswahl sichtbar, Header zeigt "Smart Formular"
2. Nach Auswahl von z.B. VIACTIV: Header zeigt "VIACTIV Formular", alle relevanten Felder erscheinen
3. BKK GS ist versteckt, aber der Code bleibt für spätere Reaktivierung

