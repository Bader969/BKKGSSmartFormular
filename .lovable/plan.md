
# Novitas BKK Familienversicherung - Implementierungsplan

## Zusammenfassung

Eine neue Krankenkassen-Option "Novitas BKK" wird hinzugefügt, die **nur Familienversicherung** (ohne Mitgliedschaft oder Bonus) ermöglicht. Die Logik folgt 1:1 dem BKK GS Familienversicherungs-Pattern.

---

## PDF-Template

Das neu hochgeladene PDF wird verwendet:
```
user-uploads://nov_antrag-auf-familienversicherung-2.pdf
→ Kopieren nach: public/novitas-familienversicherung.pdf
```

---

## Änderungen im Überblick

### 1. Datenmodell erweitern (`src/types/form.ts`)

```typescript
// Erweitere Krankenkasse-Typ
export type Krankenkasse = 'bkk_gs' | 'viactiv' | 'novitas';

// Erweitere KRANKENKASSEN_OPTIONS
export const KRANKENKASSEN_OPTIONS = [
  { value: 'bkk_gs' as Krankenkasse, label: 'BKK GILDEMEISTER SEIDENSTICK' },
  { value: 'viactiv' as Krankenkasse, label: 'VIACTIV Krankenkasse' },
  { value: 'novitas' as Krankenkasse, label: 'Novitas BKK' },
] as const;
```

### 2. Neue Export-Datei (`src/utils/novitasExport.ts`)

Eine neue Export-Datei folgt der Struktur von `pdfExport.ts` (BKK GS).

### 3. UI-Anpassung (`src/pages/Index.tsx`)

Novitas-spezifische Sektionen und Export-Logik hinzufügen.

---

## Automatische Felder und Synchronisationen

### Automatische Berechnungen

| Feld | Berechnung | Beispiel (Januar 2026) |
|------|------------|------------------------|
| **Beginn Familienversicherung** | 1. Tag des 3. Kalendermonats | 01.04.2026 |
| **Bisherige Versicherung endet am** | Letzter Tag vor Beginn | 31.03.2026 |
| **Heutiges Datum** | Aktuelles Datum | 29.01.2026 |

### Automatisch angekreuzte Felder

| Feld | Wert | Begründung |
|------|------|------------|
| "Ich war bisher" | Im Rahmen einer eigenen Mitgliedschaft | Standard |
| "Anlass für Aufnahme" | Beginn meiner Mitgliedschaft (`abgabegrund.B`) | Standard |
| Versicherungsart Kinder | Familienversicherung | Kinder werden immer familienversichert |

### Feld-Synchronisationen

| Feld | Sync-Quelle |
|------|-------------|
| KVNR (Seite 2 + 3) | `mitgliedKvNummer` (immer vom Hauptmitglied) |
| Ehegatte "Versicherung bestand bei" | `mitgliedKrankenkasse` (Fallback) |
| Kinder "Versicherung bestand bei" | `mitgliedKrankenkasse` |
| Ehegatte "war familienversichert bei" | `mitgliedVorname, mitgliedName` |
| Kinder "war familienversichert bei" | `mitgliedVorname, mitgliedName` |
| Geburtsname | Nachname (Fallback wenn leer) |

---

## PDF-Feld-Mapping

### Seite 2 - Mitglied

| Feld | PDF-Feldname | Quelle |
|------|--------------|--------|
| Vorname Name | `NameGesamt` | `${mitgliedVorname} ${mitgliedName}` |
| KV-Nummer | `KVNR.` | `mitgliedKvNummer` (beide Seiten) |
| Beginn Familienvers. | `fna_BeginnFamiVers` | Automatisch berechnet |
| Telefon | `fna_Telefon` | `telefon` |
| E-Mail | `fna_Email` | `email` |
| Datum | `datum` | Aktuelles Datum (Seite 3) |

### Familienstand (RadioButtons)

| Wert | Feldname |
|------|----------|
| Ledig | `fna_Famstand.L` |
| Verheiratet | `fna_Famstand.V` |
| Getrennt lebend | `fna_Famstand.GL` |
| Geschieden | `fna_Famstand.G` |
| Verwitwet | `fna_Famstand.W` |
| Lebenspartnerschaft | `fna_Famstand.E` |

### Abgabegrund (RadioButtons)

| Grund | Feldname | Wert |
|-------|----------|------|
| Beginn Beschäftigung | `abgabegrund.B` | **true** (Standard) |

### Seite 2 - Ehegatte (Partner)

| Feld | PDF-Feldname |
|------|--------------|
| Name | `fna_PartnerName` |
| Vorname | `fna_PartnerVorname` |
| Geschlecht m | `fna_PartnerGeschlecht.m` |
| Geschlecht w | `fna_PartnerGeschlecht.w` |
| Geschlecht x | `fna_PartnerGeschlecht.x` |
| Geschlecht d | `fna_PartnerGeschlecht.d` |
| Geburtsdatum | `fna_PartnerGebdat` |
| Straße (Versichertennummer) | `bw_strasse_partner` |
| PLZ | `fna_PartnerPlz` |
| Ort | `fna_PartnerOrt` |

### Seite 2 - Kinder (1-3)

| Feld | Kind 1 | Kind 2 | Kind 3 |
|------|--------|--------|--------|
| Name | `name_kind_1` | `name_kind_2` | `name_kind_3` |
| Vorname | `vorname_kind_1` | `vorname_kind_2` | `vorname_kind_3` |
| Geschlecht m | `geschlecht_kind_1.m` | `geschlecht_kind_2.m` | `geschlecht_kind_3.m` |
| Geschlecht w | `geschlecht_kind_1.w` | `geschlecht_kind_2.w` | `geschlecht_kind_3.w` |
| Geschlecht x | `geschlecht_kind_1.x` | `geschlecht_kind_2.x` | `geschlecht_kind_3.x` |
| Geschlecht d | `geschlecht_kind_1.d` | `geschlecht_kind_2.d` | `geschlecht_kind_3.d` |
| Geburtsdatum | `gebdat_kind_1` | `gebdat_kind_2` | `gebdat_kind_3` |
| Straße | `bw_strasse_kind_1` | `bw_strasse_kind_2` | `bw_strasse_kind_3` |
| PLZ | `fna_KindPlz_1` | `fna_KindPlz_2` | `fna_KindPlz_3` |
| Ort | `fna_KindOrt_1` | `fna_KindOrt_2` | `fna_KindOrt_3` |

### Verwandtschaft (RadioButtons)

| Verwandtschaft | Kind 1 | Kind 2 | Kind 3 |
|---------------|--------|--------|--------|
| Leiblich | `fna_KindVerwandt_1.L` | `fna_KindVerwandt_2.L` | `fna_KindVerwandt_3.L` |
| Stief | `fna_KindVerwandt_1.S` | `fna_KindVerwandt_2.S` | `fna_KindVerwandt_3.S` |
| Enkel | `fna_KindVerwandt_1.E` | `fna_KindVerwandt_2.E` | `fna_KindVerwandt_3.E` |
| Pflege | `fna_KindVerwandt_1.P` | `fna_KindVerwandt_2.P` | `fna_KindVerwandt_3.P` |

### Seite 3 - Bisherige Versicherung (Ehegatte)

| Feld | PDF-Feldname | Quelle |
|------|--------------|--------|
| KV-Nr. Mitglied | `KVNR.` | `mitgliedKvNummer` |
| Endete am | `fna_PartnerVersBis` | Automatisch berechnet |
| Bestand bei | `fna_PartnerNameAltkasse` | `mitgliedKrankenkasse` (Sync) |
| Mitgliedschaft | `fna_PartnerVersArt.GesetzlichMitglied` | RadioButton |
| Familienvers. | `fna_PartnerVersArt.GesetzlichFAMI` | RadioButton |
| Nicht gesetzl. | `fna_PartnerVersArt.NichtGesetzlich` | RadioButton |
| Vorname | `famv_vorname_bisher_kv_partner` | `mitgliedVorname` (Sync) |
| Nachname | `famv_name_bisher_kv_partner` | `mitgliedName` (Sync) |
| Aktuelle Kasse | `fna_PartnerAktuelleKasse` | `bisherigBestehtWeiterBei` |

### Seite 3 - Personendaten (Ehegatte) - OHNE RV-Nummer

| Feld | PDF-Feldname |
|------|--------------|
| Geburtsname | `fna_PartnerGeburtsname` |
| Geburtsort | `fna_PartnerGeburtsort` |
| Geburtsland | `fna_PartnerGeburtsland` |
| Staatsangehörigkeit | `fna_PartnerStaatsangehoerigkeit` |

### Seite 3 - Bisherige Versicherung (Kinder)

| Feld | Kind 1 | Kind 2 | Kind 3 |
|------|--------|--------|--------|
| Endete am | `famv_bisher_kind_1` | `famv_bisher_kind_2` | `famv_bisher_kind_3` |
| Bestand bei | `famv_kv_kind_1` | `famv_kv_kind_2` | `famv_kv_kind_3` |
| Familienvers. | `angabe_eigene_kv_kind_*.GesetzlichFAMI` | **true** | |
| Vorname | `famv_vorname_bisher_kv_kind_*` | `mitgliedVorname` | |
| Nachname | `famv_name_bisher_kv_kind_*` | `mitgliedName` | |

### Seite 3 - Personendaten (Kinder) - OHNE RV-Nummer

| Feld | Kind 1 | Kind 2 | Kind 3 |
|------|--------|--------|--------|
| Geburtsname | `geburtsname_kind_1` | `geburtsname_kind_2` | `geburtsname_kind_3` |
| Geburtsort | `geburtsort_kind_1` | `geburtsort_kind_2` | `geburtsort_kind_3` |
| Geburtsland | `geburtsland_kind_1` | `geburtsland_kind_2` | `geburtsland_kind_3` |
| Staatsangehörigkeit | `staatsangehoerigkeit_kind_1` | `staatsangehoerigkeit_kind_2` | `staatsangehoerigkeit_kind_3` |

### Datum + Unterschrift (Seite 3)

| Feld | PDF-Feldname | Position |
|------|--------------|----------|
| Datum | `datum` | Left=75, Top=708 |

Unterschriften werden neben dem Datum-Feld positioniert (wie bei BKK GS).

---

## Felder die NICHT ausgefüllt werden

| Kategorie | Felder |
|-----------|--------|
| **RV-Nummer** | `fna_PartnerRvnr`, `rvnr_kind_1/2/3` |
| **Einkommen** | `fna_PartnerEinkommenSelbst`, `gewinn_kind_*`, `brutto_kind_*` |
| **Selbstständigkeit** | `selbststaendig_partner`, `selbststaendig_kind_*` |
| **Minijob** | `minijob_partner`, `minijob_kind_*` |
| **Renten** | `renten_kind_*` |
| **Wehrdienst/Schule** | `fna_wehrdienst_*`, `fna_schule_*` |

---

## UI-Anpassung (`src/pages/Index.tsx`)

### Novitas zeigt dieselben Sektionen wie BKK GS (ohne Rundum-Sicher-Paket)

```typescript
{formData.selectedKrankenkasse === 'novitas' && (
  <>
    <SpouseSection formData={formData} updateFormData={updateFormData} />
    <ChildrenSection formData={formData} updateFormData={updateFormData} />
  </>
)}
```

### Beschreibungstext

```typescript
{formData.selectedKrankenkasse === 'novitas' 
  ? 'Es wird die Novitas BKK Familienversicherung erstellt.'
  : formData.selectedKrankenkasse === 'viactiv' 
    ? 'Es wird die VIACTIV Beitrittserklärung erstellt.'
    : 'Es werden BKK GS Familienversicherung und Rundum-Sicher-Paket erstellt.'}
```

### Validierung (Novitas)

```typescript
if (formData.selectedKrankenkasse === 'novitas') {
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
  if (!formData.ort) {
    toast.error('Bitte geben Sie den Ort ein.');
    return;
  }
}
```

### Export-Logik

```typescript
else if (formData.selectedKrankenkasse === 'novitas') {
  const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 3));
  toast.info(`Es werden ${numberOfPDFs} Novitas Familienversicherungs-PDF(s) erstellt.`);
  await exportNovitasFamilienversicherung(formData);
  toast.success('Novitas BKK Familienversicherung erfolgreich exportiert!');
}
```

---

## Multi-PDF-Logik

Bei mehr als 3 Kindern werden mehrere PDFs erstellt (wie bei BKK GS):

```
Novitas_Familienversicherung_{Vorname}_{Nachname}.pdf
Novitas_Familienversicherung_{Vorname}_{Nachname}_Teil2.pdf (bei >3 Kindern)
```

---

## Dateien-Übersicht

| Datei | Aktion |
|-------|--------|
| `public/novitas-familienversicherung.pdf` | Neu (von user-uploads kopieren) |
| `src/types/form.ts` | Krankenkasse-Typ erweitern |
| `src/utils/novitasExport.ts` | Neue Datei erstellen |
| `src/pages/Index.tsx` | Novitas-Logik hinzufügen |

---

## Unterschiede zu anderen Krankenkassen

| Aspekt | BKK GS | VIACTIV | Novitas BKK |
|--------|--------|---------|-------------|
| Familienversicherung | Ja | Ja | Ja |
| Mitgliedschaft (BE) | Nein | Ja | Nein |
| Rundum-Sicher-Paket | Ja | Nein | Nein |
| Bonus-Programm | Nein | Ja | Nein |
| Modus-Auswahl | Ja | Nein | Nein |
| Max. Kinder pro PDF | 3 | 3 | 3 |
