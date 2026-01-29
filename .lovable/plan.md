
# Novitas BKK: Export-Validierung anpassen

## Problem

Beim Exportieren erscheint der Fehler "Bitte geben Sie das Geburtsdatum des Mitglieds ein", obwohl dieses Feld in der UI für Novitas BKK nicht mehr angezeigt wird.

## Ursache

In `src/pages/Index.tsx` gibt es eine **allgemeine Basis-Validierung** (Zeilen 74-88) die für ALLE Krankenkassen gilt:

```typescript
// Basis-Validierung für alle Krankenkassen
if (!formData.mitgliedName || !formData.mitgliedVorname) {
  toast.error('Bitte geben Sie Name und Vorname des Mitglieds ein.');
  return;
}

if (!formData.mitgliedGeburtsdatum) {  // <-- Dieses Feld ist für Novitas versteckt!
  toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
  return;
}
```

Zusätzlich prüft die Novitas-spezifische Validierung (Zeilen 122-140) auch auf `ort`, das ebenfalls ausgeblendet ist.

## Lösung

Die Export-Validierung anpassen, sodass nur die tatsächlich benötigten Felder für Novitas BKK geprüft werden.

---

## Änderungen in Index.tsx

### Vorher (Zeilen 73-140):

```typescript
const handleExport = async () => {
  // Basis-Validierung für alle Krankenkassen
  if (!formData.mitgliedName || !formData.mitgliedVorname) {
    toast.error('...');
    return;
  }
  
  if (!formData.mitgliedGeburtsdatum) {  // ← Blockiert Novitas!
    toast.error('...');
    return;
  }
  
  // ...
  
  // Novitas-spezifische Validierung
  else if (formData.selectedKrankenkasse === 'novitas') {
    // ...
    if (!formData.ort) {  // ← Feld ist ausgeblendet!
      toast.error('...');
      return;
    }
  }
};
```

### Nachher:

```typescript
const handleExport = async () => {
  // Basis-Validierung für alle Krankenkassen
  if (!formData.mitgliedName || !formData.mitgliedVorname) {
    toast.error('Bitte geben Sie Name und Vorname des Mitglieds ein.');
    return;
  }
  
  // Geburtsdatum nur prüfen wenn NICHT Novitas (bei Novitas ausgeblendet)
  if (formData.selectedKrankenkasse !== 'novitas' && !formData.mitgliedGeburtsdatum) {
    toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
    return;
  }
  
  if (!formData.unterschrift) {
    toast.error('Bitte unterschreiben Sie das Formular.');
    return;
  }
  
  // ... VIACTIV-spezifische Validierung bleibt gleich ...
  
  // Novitas-spezifische Validierung (ANGEPASST)
  else if (formData.selectedKrankenkasse === 'novitas') {
    if (!formData.mitgliedKvNummer) {
      toast.error('Bitte geben Sie die KV-Nummer ein.');
      return;
    }
    if (!formData.mitgliedKrankenkasse) {
      toast.error('Bitte geben Sie den Namen der Krankenkasse ein.');
      return;
    }
    if (!formData.familienstand) {
      toast.error('Bitte wählen Sie den Familienstand aus.');
      return;
    }
    // ENTFERNT: Ort-Validierung (Feld ist für Novitas ausgeblendet)
    // if (!formData.ort) { ... }
  }
};
```

---

## Zusammenfassung der Änderungen

| Validierung | Vorher | Nachher |
|-------------|--------|---------|
| `mitgliedGeburtsdatum` | Für alle Krankenkassen | NUR wenn nicht Novitas |
| `ort` (bei Novitas) | Geprüft | **Entfernt** |

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/Index.tsx` | Zeilen 80-83: Geburtsdatum-Check mit Novitas-Ausnahme; Zeilen 136-139: Ort-Check entfernen |

---

## Ergebnis

Nach dieser Änderung kann der Novitas BKK Export durchgeführt werden, ohne dass versteckte Felder (Geburtsdatum, Adresse) validiert werden müssen. Nur die sichtbaren Pflichtfelder werden geprüft:
- Name + Vorname
- KV-Nummer
- Name der Krankenkasse
- Familienstand
- Unterschrift
