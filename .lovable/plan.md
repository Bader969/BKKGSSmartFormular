

# Novitas BKK: "Bisherige Versicherung besteht weiter bei" Fix

## Problem

Wenn "Bisherige Versicherung besteht weiter" aktiviert ist und z.B. "Novitas BKK" im Feld darunter steht, wird auf dem PDF **nicht** dieser Wert geschrieben, sondern die Krankenkasse des Hauptmitglieds (`formData.mitgliedKrankenkasse`).

## Analyse des aktuellen Codes

### Ehepartner (Zeilen 191-194):
```typescript
// Current Kasse if continues
if (ehegatte.bisherigBestehtWeiter) {
  setTextField("fna_PartnerAktuelleKasse", ehegatte.bisherigBestehtWeiterBei);
}
```
**Hier ist es korrekt!** - Es verwendet `ehegatte.bisherigBestehtWeiterBei`.

### Kinder (Zeilen 252-254):
```typescript
// Page 3 - Previous insurance - AUTO-SYNC
setTextField(`famv_bisher_kind_${i}`, dates.endDate);
setTextField(`famv_kv_kind_${i}`, formData.mitgliedKrankenkasse);  // ← FALSCH!
```
**Hier liegt der Fehler!** - Es verwendet `formData.mitgliedKrankenkasse` statt `kind.bisherigBestehtWeiterBei`.

### Zusätzlich Ehepartner (Zeile 173):
```typescript
setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestandBei || formData.mitgliedKrankenkasse);
```
**Auch falsch!** - Bei `bisherigBestehtWeiter=true` sollte `bisherigBestehtWeiterBei` verwendet werden, nicht `bisherigBestandBei`.

---

## Lösung

### 1. fillSpouseFields korrigieren (Zeilen 171-173)

**Vorher:**
```typescript
// Previous insurance - AUTO-SYNC with member's Krankenkasse
setTextField("fna_PartnerVersBis", dates.endDate);
setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestandBei || formData.mitgliedKrankenkasse);
```

**Nachher:**
```typescript
// Previous insurance
setTextField("fna_PartnerVersBis", dates.endDate);

// Wenn "besteht weiter" aktiviert: Wert aus bisherigBestehtWeiterBei nehmen
// Ansonsten: Fallback auf bisherigBestandBei oder mitgliedKrankenkasse
if (ehegatte.bisherigBestehtWeiter && ehegatte.bisherigBestehtWeiterBei) {
  setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestehtWeiterBei);
} else {
  setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestandBei || formData.mitgliedKrankenkasse);
}
```

### 2. fillChildFields korrigieren (Zeilen 252-254)

**Vorher:**
```typescript
// Page 3 - Previous insurance - AUTO-SYNC
setTextField(`famv_bisher_kind_${i}`, dates.endDate);
setTextField(`famv_kv_kind_${i}`, formData.mitgliedKrankenkasse);
```

**Nachher:**
```typescript
// Page 3 - Previous insurance
setTextField(`famv_bisher_kind_${i}`, dates.endDate);

// Wenn "besteht weiter" aktiviert: Wert aus bisherigBestehtWeiterBei nehmen
// Ansonsten: Fallback auf bisherigBestandBei oder mitgliedKrankenkasse
if (kind.bisherigBestehtWeiter && kind.bisherigBestehtWeiterBei) {
  setTextField(`famv_kv_kind_${i}`, kind.bisherigBestehtWeiterBei);
} else {
  setTextField(`famv_kv_kind_${i}`, kind.bisherigBestandBei || formData.mitgliedKrankenkasse);
}
```

---

## Zusammenfassung der Änderungen

| Datei | Zeilen | Änderung |
|-------|--------|----------|
| `src/utils/novitasExport.ts` | 171-173 | Ehepartner: `bisherigBestehtWeiterBei` priorisieren wenn "besteht weiter" aktiviert |
| `src/utils/novitasExport.ts` | 252-254 | Kinder: `bisherigBestehtWeiterBei` priorisieren wenn "besteht weiter" aktiviert |

---

## Ergebnis

| Situation | Vorher | Nachher |
|-----------|--------|---------|
| "Besteht weiter" aktiviert mit "Novitas BKK" | Name der Mitglied-Krankenkasse | "Novitas BKK" (aus dem UI-Feld) |
| "Besteht weiter" nicht aktiviert | Name der Mitglied-Krankenkasse | Fallback auf bisherigBestandBei oder mitgliedKrankenkasse |

