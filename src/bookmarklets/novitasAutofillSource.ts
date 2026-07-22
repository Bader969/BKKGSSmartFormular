/**
 * Source code of the "Novitas Autofill" bookmarklet.
 *
 * Wird auf `novitas-bkk.de/formulare/kundenservice?...` ausgeführt und befüllt
 * das Formular anhand eines JSON-Payloads aus der Zwischenablage.
 * Der Payload muss dem Typ `novitas-autofill/v1` entsprechen.
 */
export const NOVITAS_BOOKMARKLET_VERSION = "2026-07-22-2";

const BOOKMARKLET_BODY = /* js */ `
(async function(){
  var LOG_PREFIX = "[Novitas-Autofill]";
  var BOOKMARKLET_VERSION = "${NOVITAS_BOOKMARKLET_VERSION}";
  function log(){ try { console.log.apply(console, [LOG_PREFIX].concat([].slice.call(arguments))); } catch(_){} }

  function showOverlay(html){
    var id = "novitas-autofill-overlay";
    var el = document.getElementById(id);
    if (!el){
      el = document.createElement("div");
      el.id = id;
      el.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;background:#7a1f2b;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:12px 14px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:340px;";
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

  var raw;
  try { raw = await navigator.clipboard.readText(); }
  catch(e){ showOverlay("❌ <b>Zwischenablage nicht lesbar.</b><br>Bitte in deiner App den 'Novitas online ausfüllen'-Button erneut klicken."); return; }
  var data; try { data = JSON.parse(raw); } catch(_){ showOverlay("❌ Zwischenablage enthält kein gültiges JSON."); return; }
  if (!data || data.__type !== "novitas-autofill/v1"){ showOverlay("❌ Kein Novitas-Autofill-Payload in der Zwischenablage."); return; }
  log("version", BOOKMARKLET_VERSION, "payload", data);

  function norm(s){ return (s||"").toString().toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
  function hayHas(hay, pat){
    if (!pat) return false;
    var padded = " " + hay + " ";
    var tokens = pat.split(" ").filter(Boolean);
    for (var t=0; t<tokens.length; t++){ if (padded.indexOf(" " + tokens[t] + " ") === -1) return false; }
    return true;
  }

  function setNative(el, val){
    try {
      var tag = el.tagName;
      var proto = tag === "TEXTAREA" ? HTMLTextAreaElement.prototype
        : tag === "SELECT" ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, val == null ? "" : String(val));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    } catch(e){ log("setNative fail", e); return false; }
  }

  /** Findet ein Feld primär über 'name' (form0.<key>) oder id/label. */
  function findField(patterns, opts){
    opts = opts || {};
    var wantTypes = opts.types; // z.B. ['select','checkbox','radio','date','text']
    var pats = patterns.map(norm).filter(Boolean);
    var candidates = Array.prototype.slice.call(document.querySelectorAll("input, textarea, select"));
    var attrMatch = null, labelMatch = null;
    for (var i=0; i<candidates.length; i++){
      var el = candidates[i];
      if (el.disabled) continue;
      if (el.offsetParent === null && el.type !== "hidden") continue;
      if (wantTypes && wantTypes.length){
        var t = el.tagName === "SELECT" ? "select" : (el.type||"text").toLowerCase();
        if (wantTypes.indexOf(t) === -1) continue;
      }
      var attrHay = [
        el.getAttribute("name"),
        el.id,
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
      ].map(norm).join(" ");
      var labelHay = "";
      if (el.id){
        var lbl = document.querySelector('label[for="'+CSS.escape(el.id)+'"]');
        if (lbl) labelHay += " " + norm(lbl.textContent);
      }
      var wrap = el.closest("form-date-input, form-dropdown, form-text-input, form-checkbox, form-radio-group, .form-field, label");
      if (wrap) labelHay += " " + norm(wrap.textContent).slice(0, 300);
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

  function fill(patterns, value, label, opts){
    if (value == null || value === "") return { filled:false, skipped:true, label: label };
    var el = findField(patterns, opts);
    if (!el) return { filled:false, missing:true, label: label };
    var ok = setNative(el, value);
    return { filled: ok, label: label };
  }

  function selectByValueOrText(patterns, value, textAlternatives, label){
    var el = findField(patterns, { types: ["select"] });
    if (!el) return { filled:false, missing:true, label: label };
    var opts = Array.prototype.slice.call(el.options);
    var target = null;
    if (value){
      for (var i=0; i<opts.length; i++){
        if (opts[i].value === value){ target = opts[i]; break; }
      }
    }
    if (!target && textAlternatives && textAlternatives.length){
      var alts = textAlternatives.map(norm);
      for (var j=0; j<opts.length; j++){
        var t = norm(opts[j].textContent);
        for (var k=0; k<alts.length; k++){
          if (alts[k] && t.indexOf(alts[k]) !== -1){ target = opts[j]; break; }
        }
        if (target) break;
      }
    }
    if (!target) return { filled:false, missing:true, label: label };
    var ok = setNative(el, target.value);
    return { filled: ok, label: label };
  }

  function setCheckbox(patterns, checked, label){
    var el = findField(patterns, { types: ["checkbox"] });
    if (!el) return { filled:false, missing:true, label: label };
    if (el.checked !== !!checked){ el.click(); }
    return { filled:true, label: label };
  }

  function selectRadioByValueOrLabel(patterns, valueCandidates, labelTexts, label){
    var pats = patterns.map(norm).filter(Boolean);
    var radios = Array.prototype.slice.call(document.querySelectorAll('input[type="radio"]'));
    var vals = (valueCandidates||[]).map(function(v){ return String(v||""); });
    var texts = (labelTexts||[]).map(norm);
    for (var i=0; i<radios.length; i++){
      var r = radios[i];
      if (r.disabled) continue;
      var nameHay = norm(r.getAttribute("name")||"") + " " + norm(r.id||"");
      var wrap = r.closest("form-radio-group, .form-field, label, fieldset");
      var wrapText = wrap ? norm(wrap.textContent).slice(0,300) : "";
      var matchesGroup = false;
      for (var p=0; p<pats.length; p++){
        if (hayHas(nameHay, pats[p]) || hayHas(wrapText, pats[p])){ matchesGroup = true; break; }
      }
      if (!matchesGroup) continue;
      // Wert-Match
      if (vals.length && vals.indexOf(r.value) !== -1){
        if (!r.checked){ r.click(); }
        return { filled:true, label: label };
      }
      // Label-Match
      if (texts.length){
        var lbl = r.id ? document.querySelector('label[for="'+CSS.escape(r.id)+'"]') : null;
        var lblText = lbl ? norm(lbl.textContent) : (r.parentElement ? norm(r.parentElement.textContent) : "");
        for (var t=0; t<texts.length; t++){
          if (texts[t] && lblText.indexOf(texts[t]) !== -1){
            if (!r.checked){ r.click(); }
            return { filled:true, label: label };
          }
        }
      }
    }
    return { filled:false, missing:true, label: label };
  }

  var results = [];
  var p = data.person || {};
  var addr = data.adresse || {};
  var ag = data.arbeitgeber || {};
  var bank = data.bank || {};
  var daten = data.daten || {};

  function fillByName(nameSel, value, label){
    if (value == null || value === "") return { filled:false, skipped:true, label: label };
    var el = document.querySelector('input[name="'+nameSel+'"], textarea[name="'+nameSel+'"], select[name="'+nameSel+'"]');
    if (!el) return null; // signal fallback
    var ok = setNative(el, value);
    return { filled: ok, label: label };
  }
  function fillByNames(nameSels, value, label){
    for (var i=0; i<nameSels.length; i++){
      var res = fillByName(nameSels[i], value, label);
      if (res) return res;
    }
    return null;
  }
  function clickRadioByName(nameSel, value, label){
    var el = document.querySelector('input[type="radio"][name="'+nameSel+'"][value="'+value+'"]');
    if (!el) return null;
    if (!el.checked) el.click();
    return { filled:true, label: label };
  }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  // 1) Versicherungsbeginn (Datum)
  results.push(fill(["Beginndatum","versicherungsbeginn","gewuenschter versicherungsbeginn"], daten.beginn, "Versicherungsbeginn"));

  // 2) Status "Ich bin..." Dropdown
  results.push(selectByValueOrText(
    ["versicherungsart","ich bin","personen angabe versicherungsart"],
    p.status,
    p.status === "pflichtversicherter_Arbeitnehmer" ? ["pflichtversicherte","pflichtversicherter arbeitnehmer"]
      : p.status === "Auszubildender" ? ["auszubildende"]
      : p.status === "Arbeitslose_r_Jobcenter" ? ["arbeitslose r jobcenter","jobcenter"]
      : p.status === "Arbeitslose_r_AgenturArbeit" ? ["agentur fuer arbeit","agentur","arbeitslose r agentur"]
      : [],
    "Ich bin (Status)"
  ));

  // Persönliche Daten
  results.push(fill(["vorname"], p.vorname, "Vorname"));
  results.push(fill(["nachname","familienname"], p.nachname, "Nachname"));
  results.push(fill(["geburtsdatum"], p.geburtsdatum, "Geburtsdatum", { types: ["date","text"] }));
  results.push(fill(["geburtsort"], p.geburtsort, "Geburtsort"));

  // Anrede / Geschlecht (Novitas-Werte: maennlich | weiblich | unbestimmt | divers)
  var anredeTexts = p.geschlecht === "weiblich" ? ["frau","weiblich"]
    : p.geschlecht === "maennlich" ? ["herr","männlich","mannlich"]
    : p.geschlecht === "unbestimmt" ? ["unbestimmt"]
    : p.geschlecht === "divers" ? ["divers"]
    : [];
  results.push(selectByValueOrText(["personen angabe geschlecht","anrede","geschlecht"], p.geschlecht, anredeTexts, "Geschlecht"));

  // Familienstand
  var famTexts = p.familienstand === "verheiratet" ? ["verheiratet"]
    : p.familienstand === "ledig" ? ["ledig"]
    : p.familienstand === "geschieden" ? ["geschieden"]
    : p.familienstand === "verwitwet" ? ["verwitwet"]
    : p.familienstand === "getrennt" ? ["getrennt"]
    : [];
  results.push(selectByValueOrText(["familienstand"], p.familienstand, famTexts, "Familienstand"));

  // Adresse — Novitas nutzt EIN Feld "Straße und Hausnummer"
  var addrCombined = addr.strasseHausnummer || "";
  var addrRes = fillByNames(["ng.form0.personen_angabe.Strasse", "ng.form0.adresse.strasse"], addrCombined, "Straße und Hausnummer");
  if (!addrRes) addrRes = fill(["adresse strasse","strasse","straße"], addrCombined, "Straße und Hausnummer");
  results.push(addrRes);
  results.push(fill(["plz","postleitzahl"], addr.plz, "PLZ"));
  results.push(fill(["wohnort","ort","stadt"], addr.ort, "Wohnort"));

  // Kontakt
  results.push(fill(["telefon","rufnummer","mobil","handy"], data.telefon, "Telefon"));
  results.push(fill(["email","e-mail"], data.email, "E-Mail"));

  // KV-Nr
  results.push(fill(["versichertennummer","krankenversichertennummer","kvnr","kv nummer"], p.kvNummer, "Versichertennummer"));
  // Bisherige Krankenkasse — Novitas: name="ng.form0.kv.zuletzt_krankenkasse"
  var kkRes = fillByName("ng.form0.kv.zuletzt_krankenkasse", p.bisherigeKrankenkasse, "Bisherige Krankenkasse");
  if (!kkRes) kkRes = fill(["kv zuletzt krankenkasse","zuletzt krankenkasse","bisherige krankenkasse","bei der krankenkasse"], p.bisherigeKrankenkasse, "Bisherige Krankenkasse");
  results.push(kkRes);

  // Zuletzt versichert bis
  results.push(fill(["zuletzt versichert bis","versichert bis","bis"], daten.zuletztVersichertBis, "Zuletzt versichert bis"));

  // Anlass Kassenwechsel — Radio, value="Kuendigung"
  var anlassRes = clickRadioByName("ng.form0.Anlass_Wechsel.anlass", "Kuendigung", "Anlass Kassenwechsel");
  if (!anlassRes) anlassRes = selectRadioByValueOrLabel(
    ["anlass wechsel","anlass","kassenwechsel","grund"],
    ["Kuendigung"],
    ["ablauf der bindungsfrist","bindungsfrist"],
    "Anlass Kassenwechsel"
  );
  results.push(anlassRes);

  // Arbeitgeber (bei Jobcenter: Jobcenter-Name+Anschrift)
  results.push(fill(["arbeitgeber name","name arbeitgeber","name des arbeitgebers","arbeitgeber"], ag.name, "Arbeitgeber Name"));
  var agCombined = ag.strasseHausnummer || "";
  var agAddrRes = fillByNames(["ng.form0.ag.Strasse_Arbeitgeber", "ng.form0.arbeitgeber.strasse"], agCombined, "Arbeitgeber Straße und Hausnummer");
  if (!agAddrRes) agAddrRes = fill(["arbeitgeber strasse","arbeitgeber straße","strasse arbeitgeber","arbeitgeber anschrift"], agCombined, "Arbeitgeber Straße und Hausnummer");
  results.push(agAddrRes);
  results.push(fill(["arbeitgeber plz","plz arbeitgeber"], ag.plz, "Arbeitgeber PLZ"));
  results.push(fill(["arbeitgeber ort","ort arbeitgeber","stadt arbeitgeber"], ag.ort, "Arbeitgeber Ort"));
  // Arbeitsentgelt ist auf Novitas ein Dropdown mit festen Werten
  results.push(selectByValueOrText(
    ["arbeitsentgeld","arbeitsentgelt","monatliches entgelt","monatliches einkommen","brutto"],
    ag.arbeitsentgeltMonatlich,
    ag.arbeitsentgeltMonatlich === "bis_zu_603_Euro" ? ["minijob","608","603"]
      : ag.arbeitsentgeltMonatlich === "mitte" ? ["zwischen"]
      : ag.arbeitsentgeltMonatlich === "mehr_als_6450_Euro" ? ["mehr als","6.450","6450"]
      : [],
    "Monatliches Arbeitsentgelt"
  ));

  // Bank — nur Kontoinhaber + IBAN auf Novitas
  results.push(fill(["kontoinhaber"], bank.kontoinhaber, "Kontoinhaber"));
  results.push(fill(["iban"], bank.iban, "IBAN"));

  // Vertriebspartner: "Ich bin Vertriebspartner" (ja) + Vermittler-ID
  var vpRes = clickRadioByName("ng.form0.send.vertriebspartner", "ja", "Vertriebspartner (Radio)");
  if (!vpRes) vpRes = selectRadioByValueOrLabel(["send vertriebspartner","vertriebspartner"], ["ja"], ["ich bin vertriebspartner","vertriebspartner"], "Vertriebspartner (Radio)");
  results.push(vpRes);
  if (data.vertriebspartner && data.vertriebspartner.vermittlerId){
    await wait(350);
    var vmRes = fillByName("ng.form0.send.vermittler_id", data.vertriebspartner.vermittlerId, "Vermittler-ID");
    if (!vmRes) vmRes = fill(["send vermittler id","vermittler id","vermittlerid","vermittler nummer","vermittler nr"], data.vertriebspartner.vermittlerId, "Vermittler-ID");
    results.push(vmRes);
  }

  // Familienangehörige-Fragebogen (nur bei mode=familie)
  if (data.familienangehoerigeFragebogen){
    results.push(setCheckbox(["familienangehoerige","familienangehörige","fragebogen zusenden","familie mitversichert"], true, "Familienangehörige-Fragebogen"));
  }

  var filled = results.filter(function(r){ return r.filled; }).length;
  var missing = results.filter(function(r){ return r.missing; }).map(function(r){ return r.label; });
  var skipped = results.filter(function(r){ return r.skipped; }).map(function(r){ return r.label; });
  var total = results.length;

  var html = "<b>✅ "+filled+" / "+total+" Felder befüllt</b>";
  html += "<br><small>Bookmarklet-Version: " + BOOKMARKLET_VERSION + "</small>";
  html += "<br><small>Person: " + (p.label||"") + " · Modus: " + (data.mode||"") + "</small>";
  if (missing.length) html += "<br><br><b>Nicht gefunden:</b><br>" + missing.map(function(x){return "• "+x;}).join("<br>");
  if (skipped.length) html += "<br><br><span style='opacity:.7'><b>Kein Wert vorhanden:</b><br>" + skipped.map(function(x){return "• "+x;}).join("<br>") + "</span>";
  html += "<br><br><span style='opacity:.7;font-size:11px'>Nach 'Weiter' im Novitas-Assistenten das Bookmarklet erneut klicken.</span>";

  showOverlay(html);
})();
`;

/** Baut das `javascript:`-URI für den Lesezeichen-Anker. */
export function buildNovitasBookmarkletHref(): string {
  return "javascript:" + encodeURIComponent(BOOKMARKLET_BODY.trim());
}

export type { NovitasAutofillPayload } from '@/utils/novitasAutofillPayload';