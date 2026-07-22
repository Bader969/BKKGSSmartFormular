
## Ziel
Die Seite `/antraege` um zusätzliche Filter (Vertriebspartner, Monat, Zeitraum) und eine fortlaufende Nummerierungsspalte erweitern, die sich nach Filterung dynamisch anpasst.

## Änderungen in `src/pages/Applications.tsx`

### 1. Neue Filter oberhalb der Tabelle
Zusätzlich zu den bestehenden Filtern (Suche, Krankenkasse, Status, Herkunft):

- **Vertriebspartner** (Dropdown): „Alle" + alle in den geladenen Zeilen vorkommenden Vertriebspartner (analog zur bestehenden Krankenkassen-Ableitung).
- **Monat** (Dropdown): „Alle Monate" + die Liste der Monate, in denen tatsächlich Anträge erstellt wurden (Format `MM.YYYY`, absteigend sortiert). Bezugsdatum: `created_at`.
- **Zeitraum** (zwei Datumsfelder „Von" / „Bis"): filtert per `created_at`. Beide optional; wenn „Monat" gesetzt ist, wird der Zeitraum-Filter deaktiviert (und umgekehrt), damit sich beide nicht widersprechen.
- Alle Filter wirken wie die bestehenden nur auf Hauptanträge; Sub-Einträge (Ehegatte/Kinder) folgen automatisch ihrem Elternantrag über die vorhandene `grouped`-Logik.

Der Excel-Export nutzt weiterhin die gefilterte/gruppierte Liste (`grouped`) — keine Änderung nötig, außer neue Nummer-Spalte (siehe unten).

### 2. Fortlaufende Nummerierung
Neue erste Spalte **„Nr."** in der Tabelle:

- Nummer wird pro Hauptantrag in der Reihenfolge von `grouped` vergeben (1, 2, 3, …).
- Sub-Einträge zeigen die Nummer des Elternantrags mit Suffix (z.B. `3.1`, `3.2`), damit die Zuordnung sichtbar bleibt.
- Bei Filteränderung wird neu von 1 durchnummeriert.
- Spalte wird auch im Excel-Export als erste Spalte „Nr." mit ausgegeben.
- Tabellen-`colSpan` der Leer-/Ladezeilen von 13 auf 14 erhöhen.

## Nicht Teil dieses Plans
- Keine Änderung am Backend / an `applications-api`.
- Keine Änderung am Datenmodell.
- Keine Änderung an der Detail-Drawer-Ansicht.
