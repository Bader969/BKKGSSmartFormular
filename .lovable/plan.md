
# VIACTIV: Vorname und Name Felder tauschen

## Problem

Aktuell werden in der VIACTIV-Sektion die Felder in dieser Reihenfolge angezeigt:
- **Name | Vorname** (Nachname zuerst)

Gewünscht ist:
- **Vorname | Name** (Vorname zuerst)

---

## Betroffene Stellen in `src/components/ViactivSection.tsx`

### 1. Ehegatte (Zeilen 284-319)

**Aktuell:**
```
| Name | Vorname | Geburtsdatum | Geschlecht |
```

**Neu:**
```
| Vorname | Name | Geburtsdatum | Geschlecht |
```

### 2. Kinder (Zeilen 473-508)

**Aktuell:**
```
| Name | Vorname | Geburtsdatum | Geschlecht |
```

**Neu:**
```
| Vorname | Name | Geburtsdatum | Geschlecht |
```

---

## Änderungen

### Ehegatte-Sektion (Zeilen 285-302)

Die Reihenfolge der FormField-Komponenten wird getauscht:

**Vorher (Zeilen 285-302):**
```typescript
<FormField
  type="text"
  label="Name"
  id="viactiv-ehegatte-name"
  value={formData.ehegatte.name}
  ...
/>
<FormField
  type="text"
  label="Vorname"
  id="viactiv-ehegatte-vorname"
  value={formData.ehegatte.vorname}
  ...
/>
```

**Nachher:**
```typescript
<FormField
  type="text"
  label="Vorname"
  id="viactiv-ehegatte-vorname"
  value={formData.ehegatte.vorname}
  ...
/>
<FormField
  type="text"
  label="Name"
  id="viactiv-ehegatte-name"
  value={formData.ehegatte.name}
  ...
/>
```

### Kinder-Sektion (Zeilen 474-491)

**Vorher:**
```typescript
<FormField
  type="text"
  label="Name"
  id={`viactiv-kind${index}-name`}
  value={kind.name}
  ...
/>
<FormField
  type="text"
  label="Vorname"
  id={`viactiv-kind${index}-vorname`}
  value={kind.vorname}
  ...
/>
```

**Nachher:**
```typescript
<FormField
  type="text"
  label="Vorname"
  id={`viactiv-kind${index}-vorname`}
  value={kind.vorname}
  ...
/>
<FormField
  type="text"
  label="Name"
  id={`viactiv-kind${index}-name`}
  value={kind.name}
  ...
/>
```

---

## Zusammenfassung

| Datei | Zeilen | Änderung |
|-------|--------|----------|
| `src/components/ViactivSection.tsx` | 285-302 | Ehegatte: Vorname und Name Felder tauschen |
| `src/components/ViactivSection.tsx` | 474-491 | Kinder: Vorname und Name Felder tauschen |

---

## Ergebnis

| Sektion | Vorher | Nachher |
|---------|--------|---------|
| Ehegatte | Name, Vorname, Geburtsdatum, Geschlecht | **Vorname, Name**, Geburtsdatum, Geschlecht |
| Kinder | Name, Vorname, Geburtsdatum, Geschlecht | **Vorname, Name**, Geburtsdatum, Geschlecht |
