

# VIACTIV-Felder: Auto-Sync und Geburtsort/Geburtsland Korrekturen

## Zusammenfassung

Drei Korrekturen sind erforderlich:

1. **"Ja, versichert bei"** Feld für Ehepartner: Automatische Synchronisation mit `mitgliedKrankenkasse`
2. **Geburtsort / Geburtsland** für Familienversicherung: Trennung in zwei Felder mit korrekter PDF-Formatierung
3. **Unterschiedliche Formate**: BE = 2-Buchstaben-Code (DE), Familienversicherung = "Geburtsort / Geburtsland" (Berlin / Deutschland)

---

## 1. Auto-Sync: "Ja, versichert bei" Feld (Ehegatte)

**Datei: `src/components/ViactivSection.tsx`**

### Aktuelle Implementierung (Zeile 271-280):
Das Feld zeigt `bisherigBestehtWeiterBei` an, aber hat keinen Fallback auf `mitgliedKrankenkasse`.

### Korrektur:
```typescript
// Zeile 276: value mit Fallback auf mitgliedKrankenkasse
value={formData.ehegatte.bisherigBestehtWeiterBei || formData.mitgliedKrankenkasse}
```

Dies ermöglicht:
- Automatische Befüllung mit Hauptmitglied-Krankenkasse
- Manuelle Überschreibung bleibt möglich
- Beim Export wird der aktuelle Wert verwendet (auch ohne User-Interaktion)

---

## 2. Geburtsort / Geburtsland Trennung

### Aktuelle Situation:
- **Ehegatte**: Hat bereits separate Felder für Geburtsort (Textfeld, Zeile 331-338) und Geburtsland (Dropdown, Zeile 353-361)
- **Kinder**: Hat nur ein kombiniertes Feld "Geburtsort / Geburtsland" (Zeile 520-528)

### Korrektur für Kinder (Datei: `src/components/ViactivSection.tsx`):

Zeile 520-528 aufteilen in zwei Felder:

| Feld | Typ | Neue Position |
|------|-----|---------------|
| Geburtsort | Textfeld | Spalte 2 |
| Geburtsland | Dropdown (COUNTRY_OPTIONS) | Spalte 3 (verschieben) |
| Staatsangehörigkeit | Dropdown | Spalte 4 |

### Neue Grid-Struktur für Kinder (Zeile 510-546):

```text
+------------------------------------------+
| Geburtsname | Geburtsort | Geburtsland | Staatsang. |
| [_________] | [________] | [Dropdown]  | [Dropdown] |
|                                          |
| Abweichende Anschrift                    |
| [______________________________________] |
+------------------------------------------+
```

---

## 3. PDF-Export Korrekturen

### A) Familienversicherung PDF (`viactivFamilyExport.ts`)

**Format für Geburtsort/Geburtsland:**
- PDF-Feld heißt: "Ehepartner/-in Geburtsort_Geburtsland" bzw. "Kind Geburtsort_Geburtsland"
- Gewünschtes Format: "Berlin / Deutschland"

**Aktuelle Zeile 233:**
```typescript
setTextField("Ehepartner/-in Geburtsort_Geburtsland", ehegatte.geburtsort || "");
```

**Korrektur:**
```typescript
// Geburtsort und Geburtsland zusammenführen: "Berlin / Deutschland"
const geburtsortGeburtsland = ehegatte.geburtsort && ehegatte.geburtsland 
  ? `${ehegatte.geburtsort} / ${getCountryName(ehegatte.geburtsland)}`
  : ehegatte.geburtsort || "";
setTextField("Ehepartner/-in Geburtsort_Geburtsland", geburtsortGeburtsland);
```

**Aktuelle Zeile 308:**
```typescript
setTextField(fields.gebOrt, kind.geburtsort || "");
```

**Korrektur:**
```typescript
// Geburtsort und Geburtsland zusammenführen für Kinder
const kindGeburtsortGeburtsland = kind.geburtsort && kind.geburtsland
  ? `${kind.geburtsort} / ${getCountryName(kind.geburtsland)}`
  : kind.geburtsort || "";
setTextField(fields.gebOrt, kindGeburtsortGeburtsland);
```

### B) Ehegatte-Beitrittserklärung PDF (`viactivExport.ts`)

**Geburtsland bleibt als 2-Buchstaben-Code:**
- Zeile 327 ist bereits korrekt: `setTextField("Geburtsland", spouse.geburtsland || "");`
- Das Feld `spouse.geburtsland` enthält den ISO-Code (z.B. "DE", "SY")

---

## Utility-Funktion für Ländernamen

**Datei: `src/utils/countries.ts`**

Prüfen ob `getCountryName()` existiert, sonst hinzufügen:

```typescript
export const getCountryName = (code: string): string => {
  const country = COUNTRY_OPTIONS.find(c => c.code === code);
  return country?.name || code;
};
```

---

## Dateien-Übersicht

| Datei | Änderung |
|-------|----------|
| `src/components/ViactivSection.tsx` | Auto-Sync für "versichert bei", Kinder-Geburtsort/Geburtsland trennen |
| `src/utils/viactivFamilyExport.ts` | Geburtsort / Geburtsland Format (Berlin / Deutschland) |
| `src/utils/countries.ts` | Ggf. getCountryName() Funktion hinzufügen |

---

## Unterschiedliche Formate: Übersicht

| PDF-Typ | Feld | Format | Beispiel |
|---------|------|--------|----------|
| **Beitrittserklärung (BE)** | Geburtsland | 2-Buchstaben ISO-Code | "DE" |
| **Familienversicherung** | Geburtsort_Geburtsland | "Ort / Land" | "Berlin / Deutschland" |

Diese Unterscheidung ist bereits korrekt implementiert:
- BE: `spouse.geburtsland` → ISO-Code (z.B. "DE")
- Familienversicherung: Kombination aus `geburtsort` + `getCountryName(geburtsland)`

---

## Auto-Sync Logik: Zusammenfassung

Die folgenden Felder werden automatisch synchronisiert:

| Feld | Sync-Quelle | Überschreibbar |
|------|-------------|----------------|
| Ehegatte "Ja, versichert bei" | `mitgliedKrankenkasse` | Ja |
| Ehegatte "Versicherung bestand bei" | `mitgliedKrankenkasse` | Ja |
| Kinder "Versicherung bestand bei" | `mitgliedKrankenkasse` | Ja |
| Bonus-Kontoinhaber | `mitgliedVorname mitgliedName` | Ja |

Alle diese Felder haben einen Fallback auf den Hauptmitglied-Wert, sodass sie auch ohne Benutzerinteraktion korrekt exportiert werden.

