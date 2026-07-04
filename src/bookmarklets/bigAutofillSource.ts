/**
 * Source code of the "BIG Autofill" bookmarklet.
 *
 * Wird auf `www.big-direkt.de` (Angular-SPA) ausgeführt und befüllt
 * das Online-Mitgliedsantragsformular anhand eines JSON-Payloads,
 * das zuvor in der Zwischenablage abgelegt wurde.
 *
 * Der Code läuft in einer IIFE, damit lokale Variablen die BIG-Seite
 * nicht verschmutzen. Er greift **niemals** auf Kontodaten/IBAN/BIC
 * zu, wenn diese nicht im Payload liegen.
 */

// Wird als String eingebettet, deshalb kein Modul-Export von JS-Code.
// Die Funktion wird als String stringifiziert und in ein `javascript:`
// URI verpackt (siehe `buildBookmarkletHref`).
//
// WICHTIG: Keine ES-Module-Imports, kein TS. Nur Vanilla-JS.
const BOOKMARKLET_BODY = /* js */ `
(async function(){
  var LOG_PREFIX = "[BIG-Autofill]";
  function log(){ try { console.log.apply(console, [LOG_PREFIX].concat([].slice.call(arguments))); } catch(_){} }

  function showOverlay(html){
    var id = "big-autofill-overlay";
    var el = document.getElementById(id);
    if (!el){
      el = document.createElement("div");
      el.id = id;
      el.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;background:#0b3a67;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:12px 14px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:340px;";
      document.body.appendChild(el);
      var close = document.createElement("button");
      close.textContent = "×";
      close.style.cssText = "position:absolute;top:4px;right:8px;background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;";
      close.onclick = function(){ el.remove(); };
      el.appendChild(close);
    }
    var body = el.querySelector(".body");
    if (!body){ body = document.createElement("div"); body.className = "body"; el.appendChild(body); }
    body.innerHTML = html;
  }

  // 1) Payload aus Zwischenablage lesen
  var raw;
  try {
    raw = await navigator.clipboard.readText();
  } catch(e) {
    showOverlay("❌ <b>Zwischenablage nicht lesbar.</b><br>Bitte in deiner App den 'BIG online ausfüllen'-Button erneut klicken und diese Seite die Clipboard-Berechtigung erlauben.");
    return;
  }
  var data;
  try { data = JSON.parse(raw); } catch(_) {
    showOverlay("❌ Zwischenablage enthält kein gültiges Antrags-JSON. Bitte in deiner App auf 'BIG online ausfüllen' klicken.");
    return;
  }
  if (!data || data.__type !== "big-autofill/v1"){
    showOverlay("❌ Zwischenablage enthält kein BIG-Autofill-Payload.<br>Bitte in deiner App den 'BIG online ausfüllen'-Button klicken.");
    return;
  }
  log("payload", data);

  // 2) Angular-kompatibler Setter
  function setNative(el, val){
    try {
      var tag = el.tagName;
      var proto = tag === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, val == null ? "" : String(val));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    } catch(e){ log("setNative fail", e); return false; }
  }

  function norm(s){ return (s||"").toString().toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }

  // Wortweises Matching gegen einen mit Leerzeichen normalisierten Text.
  // Ein Muster kann aus mehreren durch Leerzeichen getrennten Tokens bestehen;
  // alle Tokens müssen als eigenständige Wörter im Haystack vorkommen.
  function hayHas(hay, pat){
    if (!pat) return false;
    var padded = " " + hay + " ";
    var tokens = pat.split(" ").filter(Boolean);
    for (var t=0; t<tokens.length; t++){
      if (padded.indexOf(" " + tokens[t] + " ") === -1) return false;
    }
    return true;
  }

  // Findet Input/Textarea/Select anhand einer Liste möglicher Label-/Placeholder-/Name-/Id-Muster.
  // Zweistufig: erst Attribut-Match (formcontrolname/name/id/placeholder/aria-label/data-testid),
  // dann Label/Wrapper-Text als Fallback. Vermeidet, dass z.B. "name" innerhalb "vorname" matcht.
  function findField(patterns){
    var pats = patterns.map(norm).filter(Boolean);
    var candidates = Array.prototype.slice.call(document.querySelectorAll("input, textarea, select"));
    var attrMatch = null;
    var labelMatch = null;
    for (var i=0; i<candidates.length; i++){
      var el = candidates[i];
      if (el.type === "hidden" || el.disabled) continue;
      if (el.offsetParent === null) continue; // unsichtbar
      var attrHay = [
        el.getAttribute("formcontrolname"),
        el.getAttribute("name"),
        el.id,
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        el.getAttribute("data-testid"),
      ].map(norm).join(" ");
      var labelHay = "";
      if (el.id){
        var lbl = document.querySelector('label[for="'+CSS.escape(el.id)+'"]');
        if (lbl) labelHay += " " + norm(lbl.textContent);
      }
      var wrap = el.closest("mat-form-field, .form-field, .field, label");
      if (wrap) labelHay += " " + norm(wrap.textContent).slice(0, 200);
      for (var p=0; p<pats.length; p++){
        if (!attrMatch && hayHas(attrHay, pats[p])) { attrMatch = el; break; }
      }
      if (attrMatch) break;
      if (!labelMatch){
        for (var q=0; q<pats.length; q++){
          if (hayHas(labelHay, pats[q])) { labelMatch = el; break; }
        }
      }
    }
    return attrMatch || labelMatch;
  }

  function wait(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }

  // Angular Material <mat-select> setzen: passendes Feld finden, Trigger klicken,
  // Option im CDK-Overlay auswählen.
  async function setMatSelect(patterns, optionTexts, label){
    if (!optionTexts || !optionTexts.length) return { filled:false, skipped:true, label: label };
    var pats = patterns.map(norm).filter(Boolean);
    var opts = optionTexts.map(norm).filter(Boolean);
    var selects = Array.prototype.slice.call(document.querySelectorAll("mat-select, [role='combobox']"));
    var target = null;
    for (var i=0; i<selects.length; i++){
      var s = selects[i];
      if (s.offsetParent === null) continue;
      var hay = [
        s.getAttribute("formcontrolname"),
        s.getAttribute("name"),
        s.id,
        s.getAttribute("aria-label"),
        s.getAttribute("placeholder"),
      ].map(norm).join(" ");
      var wrap = s.closest("mat-form-field, .form-field, .field, label");
      if (wrap) hay += " " + norm(wrap.textContent).slice(0, 200);
      for (var p=0; p<pats.length; p++){
        if (hayHas(hay, pats[p])) { target = s; break; }
      }
      if (target) break;
    }
    if (!target) return { filled:false, missing:true, label: label };
    var trigger = target.querySelector(".mat-mdc-select-trigger, .mat-select-trigger") || target;
    trigger.click();
    // Auf Overlay warten
    var options = [];
    for (var w=0; w<20; w++){
      await wait(50);
      options = Array.prototype.slice.call(document.querySelectorAll(".cdk-overlay-container mat-option, .cdk-overlay-container [role='option']"));
      if (options.length) break;
    }
    if (!options.length) return { filled:false, missing:true, label: label };
    for (var o=0; o<options.length; o++){
      var ot = norm(options[o].textContent);
      for (var t=0; t<opts.length; t++){
        if (opts[t] && ot.indexOf(opts[t]) !== -1){
          options[o].click();
          await wait(30);
          return { filled:true, label: label };
        }
      }
    }
    // Nichts passendes → Overlay schließen
    document.body.click();
    return { filled:false, missing:true, label: label };
  }

  function fill(patterns, value, label){
    if (value == null || value === "") return { filled:false, skipped:true, label: label };
    var el = findField(patterns);
    if (!el) return { filled:false, missing:true, label: label };
    var ok = setNative(el, value);
    return { filled: ok, label: label };
  }

  // Radio- / Mat-Radio-Klick anhand Wert-Text
  function clickRadio(patterns, valueTexts, label){
    if (!valueTexts || !valueTexts.length) return { filled:false, skipped:true, label: label };
    var pats = patterns.map(norm);
    var texts = valueTexts.map(norm);
    var groups = Array.prototype.slice.call(document.querySelectorAll("mat-radio-group, [role='radiogroup'], .radio-group"));
    var target = null;
    for (var i=0; i<groups.length; i++){
      var g = groups[i];
      var hay = norm(g.textContent + " " + (g.getAttribute("formcontrolname")||"") + " " + (g.getAttribute("aria-label")||""));
      for (var p=0; p<pats.length; p++){ if (pats[p] && hay.indexOf(pats[p]) !== -1) { target = g; break; } }
      if (target) break;
    }
    if (!target) return { filled:false, missing:true, label: label };
    var radios = target.querySelectorAll("mat-radio-button, label, [role='radio']");
    for (var r=0; r<radios.length; r++){
      var rt = norm(radios[r].textContent);
      for (var t=0; t<texts.length; t++){
        if (texts[t] && rt.indexOf(texts[t]) !== -1){
          var clickTarget = radios[r].querySelector("input, .mat-radio-container, .mdc-radio") || radios[r];
          clickTarget.click();
          return { filled:true, label: label };
        }
      }
    }
    return { filled:false, missing:true, label: label };
  }

  // Checkbox setzen
  function setCheckbox(patterns, checked, label){
    var el = findField(patterns);
    if (!el || el.type !== "checkbox") return { filled:false, missing:true, label: label };
    if (el.checked !== !!checked) el.click();
    return { filled:true, label: label };
  }

  // 3) Felder befüllen
  var results = [];
  var m = data.mitglied || {};
  var addr = data.adresse || {};
  var bank = data.bank || {};

  // Anrede / Geschlecht — zuerst mat-select, dann Radio-Fallback
  var anredeOpts = m.geschlecht === "weiblich" ? ["frau","weiblich"]
    : m.geschlecht === "maennlich" ? ["herr","männlich","mannlich"]
    : m.geschlecht === "divers" ? ["divers"]
    : [];
  var anredeRes = await setMatSelect(["anrede","geschlecht"], anredeOpts, "Anrede / Geschlecht");
  if (!anredeRes.filled && !anredeRes.skipped){
    anredeRes = clickRadio(["anrede","geschlecht"], anredeOpts, "Anrede / Geschlecht");
  }
  results.push(anredeRes);

  // Namen (kein bloßes "name" als Muster — matcht sonst innerhalb von "vorname")
  results.push(fill(["vorname"], m.vorname, "Vorname"));
  results.push(fill(["nachname","familienname","surname","lastname"], m.nachname, "Nachname"));
  results.push(fill(["geburtsname","birthname"], m.geburtsname, "Geburtsname"));

  // Geburt
  results.push(fill(["geburtsdatum","geboren am","geb datum"], m.geburtsdatum, "Geburtsdatum"));
  results.push(fill(["geburtsort"], m.geburtsort, "Geburtsort"));

  var geburtslandRes = await setMatSelect(["geburtsland","land geburt"], [norm(m.geburtsland)], "Geburtsland");
  if (!geburtslandRes.filled && !geburtslandRes.skipped){
    geburtslandRes = fill(["geburtsland","land geburt"], m.geburtsland, "Geburtsland");
  }
  results.push(geburtslandRes);

  var staatRes = await setMatSelect(["staatsangehoerigkeit","staatsangehörigkeit","nationalitaet","nationalität"], [norm(m.staatsangehoerigkeit)], "Staatsangehörigkeit");
  if (!staatRes.filled && !staatRes.skipped){
    staatRes = fill(["staatsangehoerigkeit","staatsangehörigkeit","nationalitaet","nationalität"], m.staatsangehoerigkeit, "Staatsangehörigkeit");
  }
  results.push(staatRes);

  // Familienstand — mat-select bevorzugt
  var famOpts = m.familienstand === "verheiratet" ? ["verheiratet"]
    : m.familienstand === "ledig" ? ["ledig"]
    : m.familienstand === "geschieden" ? ["geschieden"]
    : m.familienstand === "verwitwet" ? ["verwitwet"]
    : m.familienstand === "getrennt" ? ["getrennt"]
    : [];
  var famRes = await setMatSelect(["familienstand"], famOpts, "Familienstand");
  if (!famRes.filled && !famRes.skipped){
    famRes = clickRadio(["familienstand"], famOpts, "Familienstand");
  }
  results.push(famRes);

  // Adresse
  results.push(fill(["strasse","straße","street"], addr.strasse, "Straße"));
  results.push(fill(["hausnummer","hausnr","haus nr","hnr"], addr.hausnummer, "Hausnummer"));
  results.push(fill(["plz","postleitzahl","zip"], addr.plz, "PLZ"));
  results.push(fill(["wohnort","stadt","city","ort"], addr.ort, "Ort"));

  // Kontakt
  results.push(fill(["telefon","telefonnummer","rufnummer","tel nr","mobil","handy","phone"], data.telefon, "Telefon"));
  results.push(fill(["e mail","email","mail"], data.email, "E-Mail"));

  // KV-Nummer / Versichertennummer
  results.push(fill(["versichertennummer","krankenversichertennummer","kv nummer","kvnr"], m.kvNummer, "Versichertennummer"));
  results.push(fill(["bisherige krankenkasse","aktuelle krankenkasse","krankenkasse bisher","letzte krankenkasse","vorherige krankenkasse"], m.bisherigeKrankenkasse, "Bisherige Krankenkasse"));

  // Bank
  results.push(fill(["kontoinhaber"], bank.kontoinhaber, "Kontoinhaber"));
  results.push(fill(["iban"], bank.iban, "IBAN"));
  results.push(fill(["bic","swift"], bank.bic, "BIC"));
  results.push(fill(["kreditinstitut","bankname"], bank.kreditinstitut, "Kreditinstitut"));

  // Ehegatte / Kinder → als Info (Formular hat oft mehrstufige Screens)
  var famInfo = "";
  if (data.ehegatte && (data.ehegatte.vorname || data.ehegatte.nachname)){
    famInfo += "Ehegatte: " + [data.ehegatte.vorname, data.ehegatte.nachname].filter(Boolean).join(" ") + (data.ehegatte.geburtsdatum ? " · " + data.ehegatte.geburtsdatum : "") + "<br>";
  }
  if (data.kinder && data.kinder.length){
    famInfo += "Kinder: " + data.kinder.map(function(k){ return [k.vorname, k.nachname].filter(Boolean).join(" ") + (k.geburtsdatum ? " ("+k.geburtsdatum+")" : ""); }).join(", ");
  }

  var filled = results.filter(function(r){ return r.filled; }).length;
  var missing = results.filter(function(r){ return r.missing; }).map(function(r){ return r.label; });
  var skipped = results.filter(function(r){ return r.skipped; }).map(function(r){ return r.label; });
  var total = results.length;

  var html = "<b>✅ "+filled+" / "+total+" Felder befüllt</b>";
  if (missing.length) html += "<br><br><b>Nicht gefunden:</b><br>" + missing.map(function(x){return "• "+x;}).join("<br>");
  if (skipped.length) html += "<br><br><span style='opacity:.7'><b>Kein Wert vorhanden:</b><br>" + skipped.map(function(x){return "• "+x;}).join("<br>") + "</span>";
  if (famInfo) html += "<br><br><b>Familie (bitte manuell übertragen):</b><br>" + famInfo;
  html += "<br><br><span style='opacity:.7;font-size:11px'>Der BIG-Antrag ist ein mehrstufiger Assistent — die meisten „nicht gefundenen" Felder existieren erst auf den folgenden Schritten. Nach jedem „Weiter" das Bookmarklet erneut klicken.</span>";

  showOverlay(html);
})();
`;

/** Baut das `javascript:`-URI für den Lesezeichen-Anker. */
export function buildBookmarkletHref(): string {
  // encodeURIComponent, damit Zeichen wie #, %, & sauber transportiert werden.
  return "javascript:" + encodeURIComponent(BOOKMARKLET_BODY.trim());
}

/** Vom Antragslist-Button verwendete Payload-Struktur. */
export interface BigAutofillPayload {
  __type: "big-autofill/v1";
  mitglied: {
    vorname: string;
    nachname: string;
    geburtsname?: string;
    geburtsdatum: string;
    geburtsort: string;
    geburtsland: string;
    staatsangehoerigkeit?: string;
    geschlecht: "maennlich" | "weiblich" | "divers" | "";
    familienstand: string;
    kvNummer: string;
    bisherigeKrankenkasse: string;
  };
  adresse: { strasse: string; hausnummer: string; plz: string; ort: string };
  telefon: string;
  email: string;
  bank: { kontoinhaber: string; iban: string; bic: string; kreditinstitut: string };
  ehegatte?: { vorname: string; nachname: string; geburtsdatum: string } | null;
  kinder?: Array<{ vorname: string; nachname: string; geburtsdatum: string }>;
}
