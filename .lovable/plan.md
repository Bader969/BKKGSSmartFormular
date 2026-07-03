## Ziel
In der Antragsliste bekommt jeder BIG-Antrag einen Button „🔗 BIG online ausfüllen". Ein Klick öffnet die Online-Beitritts-Seite von BIG und legt die Antragsdaten in die Zwischenablage/`localStorage`. Auf der BIG-Seite klickt der Nutzer sein **Lesezeichen** („BIG Autofill") — das Bookmarklet liest die Daten und befüllt die Felder Schritt für Schritt.

## Warum kein direkter URL-Autofill?
`big-direkt.de` läuft als Angular-SPA (`<big-root ng-version="22">`). Das Formular wird per JS gerendert; es gibt **keine dokumentierten Query-Parameter** außer `distributionpartner`. Ein reines `?vorname=…` wird ignoriert. Autofill muss daher **im Browser des Nutzers auf der BIG-Domain** laufen — dafür ist ein Bookmarklet der einfachste, installationsarme Weg.

## Umsetzung

### 1) Setup-Seite in deiner App: `/big-autofill-setup`
- Erklärt in 3 Schritten, wie das Lesezeichen einmalig angelegt wird (Drag&Drop des Links in die Lesezeichenleiste, oder Rechtsklick → Lesezeichen hinzufügen).
- Zeigt einen fertigen Link `<a href="javascript:…">BIG Autofill</a>` — der `href` ist der komprimierte Bookmarklet-Code (siehe 3).
- Screenshots/Anleitung für Chrome, Edge, Firefox, Safari.

### 2) Button in der Antragsliste (`src/pages/Applications.tsx`)
- Nur sichtbar für `provider === 'big_plusbonus'`.
- Beim Klick:
  1. Baut ein normalisiertes JSON-Payload aus dem Antrag (Mitglied, Ehegatte, Kinder, Bank, Adresse, KV-Nr., Beschäftigungsstatus, Familienversicherung ja/nein …) — Feldnamen 1:1 wie sie das Bookmarklet erwartet.
  2. Schreibt es in `localStorage` unter Key `bigAutofillPayload` **auf der BIG-Domain-agnostischen Kopie**: Da localStorage domain-spezifisch ist, geht das nicht direkt. Deshalb: Payload wird in die **Zwischenablage** (`navigator.clipboard.writeText(JSON.stringify(payload))`) kopiert.
  3. Öffnet in neuem Tab: `https://www.big-direkt.de/de/mitglied-werden/online-mitglied-werden?distributionpartner=<gespeicherte-UUID>`.
  4. Toast: „Antragsdaten in Zwischenablage kopiert. Klicke auf der BIG-Seite dein Lesezeichen 'BIG Autofill'."

### 3) Bookmarklet (in `public/big-autofill.js` als Quelle, minifiziert als `javascript:`-URL eingebettet)
Der Bookmarklet-Code:
1. Liest `navigator.clipboard.readText()` → parst JSON.
2. Erkennt aktuellen Formular-Schritt (BIG führt durch mehrere Steps).
3. Setzt Angular-kompatibel Werte via **nativer Setter + Event-Dispatch**:
   ```js
   const setNative = (el, val) => {
     const proto = Object.getPrototypeOf(el);
     const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
     setter.call(el, val);
     el.dispatchEvent(new Event('input', { bubbles: true }));
     el.dispatchEvent(new Event('blur', { bubbles: true }));
   };
   ```
4. Für Radios/Checkboxes/`mat-select`: `.click()` auf das passende Element (nach `formcontrolname`, `aria-label`, sichtbarem Text).
5. Zeigt oben rechts ein kleines Overlay: „✅ 12/18 Feldern befüllt — bitte prüfen, dann 'Weiter'".
6. Bricht **nie** ab bei fehlenden Feldern — überspringt sie und listet sie im Overlay.

### 4) Field-Mapping-Tabelle
Wird durch eine einmalige Playwright-Recherche gegen die Live-Seite ermittelt (Schritt-für-Schritt jedes Feld: CSS-Selector + Typ + welchen Wert aus `FormData` er bekommt). Speicherort: `src/bookmarklets/big-field-map.ts`. Wird in das Bookmarklet gebundelt (esbuild → einzelne minifizierte IIFE).

### 5) Build-Pipeline für das Bookmarklet
- `src/bookmarklets/big-autofill.ts` (TS-Quelle, gut wartbar).
- Neues Script `bun run build:bookmarklet` → `esbuild --bundle --minify --format=iife` → wickelt in `javascript:(function(){…})()` → schreibt nach `public/bookmarklets/big-autofill.js` **und** in eine Konstante `BIG_BOOKMARKLET_HREF` in `src/pages/BigAutofillSetup.tsx`.
- Automatisch im `postbuild`-Hook.

## Was NICHT geht / Grenzen (im Setup ehrlich kommunizieren)
- Nutzer muss den Tab manuell wechseln und Lesezeichen klicken.
- BIG kann jederzeit das Formular umbauen → Field-Map muss dann in `big-field-map.ts` angepasst werden (klar dokumentiert).
- Datei-Uploads (Ausweiskopie) müssen vom Nutzer manuell hochgeladen werden — Bookmarklets dürfen aus Sicherheitsgründen keine `<input type=file>` befüllen.
- Zwischenablage: Nutzer muss beim ersten Mal die Clipboard-Berechtigung erlauben.

## Reihenfolge im Build-Modus
1. **Recherche mit Playwright**: einmal die Seite laden, jedes Feld inspizieren, Field-Map als TS erstellen. Ergebnis: Liste aller Selektoren + welche BIG-Felder wir überhaupt aus unseren Daten befüllen können.
2. Bookmarklet-Quelle + Bundler-Script.
3. Setup-Seite `/big-autofill-setup` mit Anleitung und Lesezeichen-Link.
4. Button in Antragsliste (nur `big_plusbonus`).
5. Test: 1 Beispielantrag → BIG-Seite → Bookmarklet → prüfen, welche Felder korrekt gefüllt sind, Overlay zeigt Restfelder.

## Ergebnis für dich
- Neue Route `/big-autofill-setup` mit einmaliger Lesezeichen-Installation (30 Sekunden).
- Pro BIG-Antrag ein Button „BIG online ausfüllen".
- Zwei-Klick-Workflow: Button → neues Tab → Lesezeichen → Formular ist zu ~90 % befüllt, Nutzer prüft & klickt „Weiter".