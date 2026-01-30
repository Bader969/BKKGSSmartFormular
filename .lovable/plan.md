

# Fix: Novitas BKK "Ort, Datum" Feld korrekt füllen

## Problem

Das PDF-Feld `datum` auf Seite 3 (bei der Unterschrift) erwartet ein **kombiniertes Format**:
- **Erwartet**: `Ort, Datum` (z.B. "Berlin, 30.01.2026")
- **Aktuell**: Nur das Datum wird geschrieben ("30.01.2026")

Das separate `setTextField("ort", formData.ort)` funktioniert nicht, weil es kein separates "ort"-Feld im PDF gibt.

---

## Lösung

In `src/utils/novitasExport.ts` muss die Zeile 117 angepasst werden:

**Vorher:**
```typescript
setTextField("datum", dates.today);
setTextField("ort", formData.ort);
```

**Nachher:**
```typescript
// Kombiniertes Format: "Ort, Datum" (z.B. "Berlin, 30.01.2026")
const ortDatum = formData.ort ? `${formData.ort}, ${dates.today}` : dates.today;
setTextField("datum", ortDatum);
// Entfernen: setTextField("ort", formData.ort); - Feld existiert nicht im PDF
```

---

## Änderung

| Datei | Zeilen | Beschreibung |
|-------|--------|--------------|
| `src/utils/novitasExport.ts` | 117-118 | "datum"-Feld mit kombiniertem "Ort, Datum" Format füllen |

---

## Ergebnis

| Vorher | Nachher |
|--------|---------|
| "30.01.2026" | "Berlin, 30.01.2026" |

