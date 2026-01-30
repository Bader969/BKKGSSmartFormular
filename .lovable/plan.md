

# Fix: VIACTIV Ehegatte BE - Adressdaten vom Hauptmitglied übernehmen

## Problem

Bei der Ehegatte-Beitrittserklärung (wenn der Ehegatte eine eigene Mitgliedschaft hat) werden die Adressfelder **Straße** und **PLZ** nicht ins PDF geschrieben, wenn das Feld `abweichendeAnschrift` einen Wert enthält.

### Aktuelle Logik (Zeilen 341-353):

```typescript
if (spouse.abweichendeAnschrift) {
  setTextField("Straße", "");           // ❌ Wird leer gesetzt
  setTextField("Hausnummer", "");       // ❌ Wird leer gesetzt
  setTextField("PLZ", "");              // ❌ Wird leer gesetzt
  setTextField("Ort", spouse.abweichendeAnschrift);
} else {
  setTextField("Straße", formData.mitgliedStrasse || "");
  setTextField("Hausnummer", formData.mitgliedHausnummer || "");
  setTextField("PLZ", formData.mitgliedPlz || "");
  setTextField("Ort", formData.ort || "");
}
```

---

## Lösung

Die Adressdaten (Straße, Hausnummer, PLZ) sollen **immer** vom Hauptmitglied übernommen werden. Nur der Ort kann abweichend sein.

### Neue Logik:

```typescript
// Adresse IMMER vom Hauptmitglied übernehmen
setTextField("Straße", formData.mitgliedStrasse || "");
setTextField("Hausnummer", formData.mitgliedHausnummer || "");
setTextField("PLZ", formData.mitgliedPlz || "");

// Ort: abweichende Anschrift oder vom Hauptmitglied
if (spouse.abweichendeAnschrift) {
  setTextField("Ort", spouse.abweichendeAnschrift);
} else {
  setTextField("Ort", formData.ort || "");
}
```

---

## Änderung

| Datei | Zeilen | Beschreibung |
|-------|--------|--------------|
| `src/utils/viactivExport.ts` | 341-353 | Adressfelder immer vom Hauptmitglied übernehmen |

---

## Ergebnis

| Feld | Vorher | Nachher |
|------|--------|---------|
| Straße | Leer (wenn abweichende Anschrift) | **Vom Hauptmitglied** |
| Hausnummer | Leer (wenn abweichende Anschrift) | **Vom Hauptmitglied** |
| PLZ | Leer (wenn abweichende Anschrift) | **Vom Hauptmitglied** |
| Ort | Abweichende Anschrift oder Hauptmitglied | Abweichende Anschrift oder Hauptmitglied (unverändert) |

