# Automatische Datumsangaben überschreibbar machen (alle Krankenkassen)

## Ziel
Alle automatisch berechneten Datumsangaben bleiben automatisch — bis der Nutzer sie bewusst per Klick entsperrt und ändert. Danach gilt der manuelle Wert überall: Formular, PDF-Export, E-Mail-Betreff/Vorlage, WhatsApp und Autofill (BIG / Novitas).

## Betroffene Datumsangaben
| Angabe | Automatik heute |
|---|---|
| Versicherungsbeginn | 01. des Monats in 3 Monaten |
| Ende der bisherigen Versicherung | Tag vor dem Beginn |
| Beginn Familienversicherung | wie Versicherungsbeginn |
| Unterschrifts-/Antragsdatum | heute |

Aktuell werden diese Werte an vielen Stellen unabhängig neu berechnet (u. a. `dateUtils`, `novitasExport`, `bigFamversExport`, `viactivExport`, `viactivFamilyExport`, `viactivBonusExport`, `bigPlusbonusExport`, `dakExport`, `novitasAutofillPayload`) und sind im Formular nicht bearbeitbar. Personenbezogene Felder wie „bisherige Versicherung endete am" beim Ehegatten/Kind haben schon jetzt einen Eigenwert-Vorrang (`bisherigEndeteAm || endDate`); diese Logik bleibt erhalten und wird auf den neuen Zentralwert umgestellt.

## Bedienung im Formular
Neuer Block **„Termine"** direkt bei den bereits vorhandenen „Automatisch ausgefüllten Angaben" (für jede Krankenkasse sichtbar, direkt nach der Kassenauswahl):

```text
Versicherungsbeginn            01.11.2026   [automatisch]  [Stift]
Bisherige Versicherung endet   31.10.2026   [automatisch]  [Stift]
Antrags-/Unterschriftsdatum    20.08.2026   [automatisch]  [Stift]
```

- Felder sind gesperrt und zeigen den berechneten Wert plus Badge „automatisch".
- Klick auf den Stift schaltet das Feld frei; nach dem Ändern zeigt es „manuell" und einen „Automatik wiederherstellen"-Link.
- Ändert der Nutzer den Beginn, wird das Enddatum weiter automatisch nachgezogen (Tag davor) — es sei denn, das Enddatum wurde selbst manuell gesetzt.
- Manuelle Werte werden im Antrag mitgespeichert (verschlüsseltes Payload) und beim Laden eines Antrags wieder als „manuell" angezeigt; beim Audit-Log ebenfalls enthalten.

## Wirkung
Ein einziger Auflösungspunkt liefert die Datumswerte an:
- alle PDF-Exporte (BIG Plusbonus & Familienversicherung, VIACTIV BE/FV/WB, Novitas Beitritt & FV, DAK, BKK GS)
- E-Mail-Betreff („start {Startdatum}") und Vorlagen
- WhatsApp-Nachrichten
- BIG- und Novitas-Autofill-Payload (Beginn / zuletzt versichert bis / heute)

Ohne Nutzereingriff bleiben alle heutigen Werte unverändert — es ändert sich nur die Quelle.

## Technische Umsetzung
1. `src/types/form.ts`: neue optionale Overrides `versicherungsbeginnManuell`, `bisherigeVersicherungEndeManuell`, `antragsdatumManuell` (leer = Automatik). `beginnFamilienversicherung` bleibt bestehen und wird aus dem aufgelösten Beginn gespeist.
2. `src/utils/dateUtils.ts`: neue Funktion `resolveFormDates(formData)` → `{ beginDate, endDate, today, beginIso, endIso, todayIso, isManual: {...} }`, Basis sind die bestehenden `getBeginDate`/`getEndDate`.
3. Alle Export-/Autofill-/E-Mail-Module auf `resolveFormDates(formData)` umstellen und die lokalen Datumsberechnungen entfernen (Formatierung DE/ISO/ohne Punkte bleibt pro Modul erhalten, damit sich kein PDF-Feld ändert).
4. Neue Komponente `src/components/AutoDateFields.tsx` (gesperrt/entsperrbar, Badge, Reset) und Einbindung in `src/pages/Index.tsx` bzw. den bestehenden Automatik-Block in `MemberSection`.
5. Vorsichtsmaßnahmen: keine Änderung an PDF-Feldnamen, keine Änderung an Datei-Benennungsregeln, keine Änderung der Familienversicherungs-Erstellungsregeln. Anschließende Kontrolle per Export-Test für BIG, VIACTIV, Novitas und DAK, dass ohne manuelle Eingabe exakt dieselben Werte erscheinen wie bisher.
