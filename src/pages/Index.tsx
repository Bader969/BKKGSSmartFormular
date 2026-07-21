import React, { useState, useEffect } from 'react';
import { FormData, FormMode, Krankenkasse, KRANKENKASSEN_OPTIONS, createInitialFormData } from '@/types/form';
import { MemberSection } from '@/components/MemberSection';
import { SpouseSection } from '@/components/SpouseSection';
import { ChildrenSection } from '@/components/ChildrenSection';
import { SignatureSection } from '@/components/SignatureSection';
import { RundumSicherPaketSection } from '@/components/RundumSicherPaketSection';
import { ViactivSection } from '@/components/ViactivSection';
import { BigPlusbonusSection } from '@/components/BigPlusbonusSection';
import { NovitasEmployerBank, type NovitasEmployerBankValue } from '@/components/NovitasEmployerBank';
import { splitNovitasPersons } from '@/utils/novitasSplit';
import { createEmptyArbeitgeberDaten } from '@/types/form';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, AlertCircle, Users, User, Building2, LogOut, ShieldCheck, Sparkles, ChevronRight, Save, Archive, Settings } from 'lucide-react';
import { Mail } from 'lucide-react';
import { exportFilledPDF, exportRundumSicherPaketOnly } from '@/utils/pdfExport';
import { exportViactivBeitrittserklaerung } from '@/utils/viactivExport';
import { exportViactivFamilienversicherung } from '@/utils/viactivFamilyExport';
import { exportViactivBonusPDFs } from '@/utils/viactivBonusExport';
import { exportNovitasFamilienversicherung } from '@/utils/novitasExport';
import { exportDAKFamilienversicherung } from '@/utils/dakExport';
import { exportBigPlusbonus } from '@/utils/bigPlusbonusExport';
import { exportBigFamilienversicherung } from '@/utils/bigFamversExport';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { LoginForm } from '@/components/LoginForm';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { FreitextImportDialog } from '@/components/FreitextImportDialog';
import { DocumentMergeDialog } from '@/components/DocumentMergeDialog';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { useApplicationPersistence } from '@/hooks/useApplicationPersistence';
import { useUserRole } from '@/hooks/useUserRole';
import { VERTRIEBSPARTNER_OPTIONS, VP_STORAGE_KEY, CUSTOM_VP_VALUE } from '@/utils/vertriebspartner';
import { randomPoliceBetrag, parseEuro } from '@/utils/bigRandom';
import { Input } from '@/components/ui/input';
import { normalizeInsuranceNumber } from '@/utils/insuranceNumbers';

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [isExporting, setIsExporting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const { save, saving, markExported } = useApplicationPersistence();
  const { isAdmin } = useUserRole();
  const [vpMode, setVpMode] = useState<'preset' | 'custom'>('preset');

  // Pre-fill VP from localStorage on first mount (only if no app loaded yet)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(VP_STORAGE_KEY) : null;
    if (stored) {
      setFormData((p) => (p.vertriebspartner ? p : { ...p, vertriebspartner: stored }));
      if (!(VERTRIEBSPARTNER_OPTIONS as readonly string[]).includes(stored)) {
        setVpMode('custom');
      }
    }
  }, []);

  // Sync vpMode when formData.vertriebspartner changes externally (e.g. loaded application)
  useEffect(() => {
    const vp = formData.vertriebspartner;
    if (vp && !(VERTRIEBSPARTNER_OPTIONS as readonly string[]).includes(vp)) {
      setVpMode('custom');
    }
  }, [formData.vertriebspartner]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Hydrate from a previously decrypted application (loaded via /antraege)
  useEffect(() => {
    const raw = sessionStorage.getItem('loadedApplication');
    if (!raw) return;
    try {
      const { id, payload } = JSON.parse(raw) as { id: string; payload: FormData };
      setFormData({ ...createInitialFormData(), ...payload });
      setApplicationId(id);
      sessionStorage.removeItem('loadedApplication');
      toast.success('Antrag geladen.');
    } catch {
      sessionStorage.removeItem('loadedApplication');
    }
  }, []);

  // Auto-Fill der BIG-„Mitversicherten Angehörigen" aus Ehegatte + Kindern,
  // sobald die Familienversicherungs-Variante aktiv ist.
  // Reihenfolge: Ehegatte zuerst (falls Name vorhanden), dann Kinder 1..N.
  // Format pro Eintrag: "Nachname, Vorname". `hoehePolice` wird pro Position
  // aus dem bisherigen State übernommen.
  useEffect(() => {
    if (formData.selectedKrankenkasse !== 'big_plusbonus') return;
    if (!formData.bigFamilienversicherung) return;
    // Mitversicherte-Liste = nur Familienversicherte. Personen mit
    // eigener Mitgliedschaft erscheinen NICHT in diesem Block, weil
    // sie einen eigenen Plusbonus-Antrag erhalten.
    const entries: { name: string; vorname: string }[] = [];
    const eh = formData.ehegatte;
    if (eh && (eh.name || eh.vorname) && !eh.eigeneMitgliedschaft) {
      entries.push({ name: eh.name, vorname: eh.vorname });
    }
    for (const k of formData.kinder) {
      if ((k.name || k.vorname) && !k.eigeneMitgliedschaft) {
        entries.push({ name: k.name, vorname: k.vorname });
      }
    }
    const next = entries.map((e, i) => ({
      nameVorname: [e.name, e.vorname].filter(Boolean).join(', '),
      // Police-Betrag: bestehenden Wert beibehalten, sonst zufällig 200–245.
      hoehePolice: formData.bigMitversicherte[i]?.hoehePolice || randomPoliceBetrag(),
    }));
    const prev = formData.bigMitversicherte;
    const changed =
      prev.length !== next.length ||
      next.some((n, i) => n.nameVorname !== prev[i]?.nameVorname || n.hoehePolice !== prev[i]?.hoehePolice);
    if (changed) {
      setFormData(p => ({ ...p, bigMitversicherte: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.selectedKrankenkasse,
    formData.bigFamilienversicherung,
    formData.ehegatte?.name,
    formData.ehegatte?.vorname,
    formData.ehegatte?.eigeneMitgliedschaft,
    JSON.stringify(formData.kinder.map(k => [k.name, k.vorname, k.eigeneMitgliedschaft])),
  ]);

  // BIG: „Höhe in Euro" automatisch summieren = Summe aller Policen der
  // Mitversicherten + Eigenanteil-Random (200–245) des Hauptmitglieds.
  useEffect(() => {
    if (formData.selectedKrankenkasse !== 'big_plusbonus') return;
    let self = formData.bigHoeheEuroSelfRandom;
    let updates: Partial<FormData> = {};
    if (!self) {
      self = randomPoliceBetrag();
      updates.bigHoeheEuroSelfRandom = self;
    }
    const policeSum = formData.bigMitversicherte.reduce(
      (acc, m) => acc + parseEuro(m.hoehePolice),
      0,
    );
    const total = policeSum + parseEuro(self);
    const totalStr = String(Math.round(total));
    if (totalStr !== formData.bigHoeheEuro || updates.bigHoeheEuroSelfRandom) {
      updates.bigHoeheEuro = totalStr;
      setFormData(p => ({ ...p, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.selectedKrankenkasse,
    formData.bigHoeheEuroSelfRandom,
    JSON.stringify(formData.bigMitversicherte.map(m => m.hoehePolice)),
  ]);

  // BIG Variante B: Beschäftigungsstatus + Alter steuern eigene Mitgliedschaft
  // (analog VIACTIV).
  //  - Hauptmitglied beschäftigt: alle familienversichert; Ausnahme: Ehegatte/
  //    Kinder ≥15 mit eigener Beschäftigung 'beschaeftigt' → eigene Mitgliedschaft.
  //  - Hauptmitglied arbeitslos: Ehegatte immer + Kinder ≥15 immer eigene
  //    Mitgliedschaft. Kinder <15 bleiben familienversichert.
  useEffect(() => {
    if (formData.selectedKrankenkasse !== 'big_plusbonus') return;
    if (!formData.bigFamilienversicherung) return;
    const status = formData.bigMitgliedBeschaeftigt;
    if (status !== 'beschaeftigt' && status !== 'arbeitslos') return;

    const ageOf = (g: string): number | null => {
      if (!g) return null;
      const d = g.includes('-') ? new Date(g)
        : (() => { const [dd, mm, yy] = g.split('.'); return dd && mm && yy ? new Date(Number(yy), Number(mm) - 1, Number(dd)) : null; })();
      if (!d || isNaN(d.getTime())) return null;
      return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    };

    const spouseOwn = status === 'arbeitslos'
      ? true
      : formData.ehegatte.beschaeftigung === 'beschaeftigt';
    const childOwn = (k: typeof formData.kinder[number]) => {
      const age = ageOf(k.geburtsdatum);
      if (age === null || age < 15) return false;
      if (status === 'arbeitslos') return true;
      return k.beschaeftigung === 'beschaeftigt';
    };

    const initEigen = (
      _vorname: string,
      _name: string,
    ) => ({
      versicherungsstatus: formData.bigVersicherungsstatus,
      // Eigener Plusbonus: beliebige ganze Zahl 200–245 (keine Summe).
      hoeheEuro: randomPoliceBetrag(),
      versicherungsarten: { ...formData.bigVersicherungsarten },
    });

    const newEh = {
      ...formData.ehegatte,
      eigeneMitgliedschaft: spouseOwn,
      bisherigArt: spouseOwn ? ('mitgliedschaft' as const) : ('familienversicherung' as const),
      eigenePlusbonus: spouseOwn
        ? (formData.ehegatte.eigenePlusbonus ?? initEigen(formData.ehegatte.vorname, formData.ehegatte.name))
        : formData.ehegatte.eigenePlusbonus,
    };
    const newKinder = formData.kinder.map(k => {
      const own = childOwn(k);
      return {
        ...k,
        eigeneMitgliedschaft: own,
        bisherigArt: own ? ('mitgliedschaft' as const) : ('familienversicherung' as const),
        eigenePlusbonus: own
          ? (k.eigenePlusbonus ?? initEigen(k.vorname, k.name))
          : k.eigenePlusbonus,
      };
    });

    const ehChanged =
      formData.ehegatte.eigeneMitgliedschaft !== newEh.eigeneMitgliedschaft ||
      formData.ehegatte.bisherigArt !== newEh.bisherigArt;
    const kChanged = formData.kinder.some((k, i) =>
      k.eigeneMitgliedschaft !== newKinder[i].eigeneMitgliedschaft ||
      k.bisherigArt !== newKinder[i].bisherigArt,
    );
    if (!ehChanged && !kChanged) return;

    setFormData(p => ({ ...p, ehegatte: newEh, kinder: newKinder }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.selectedKrankenkasse,
    formData.bigFamilienversicherung,
    formData.bigMitgliedBeschaeftigt,
    formData.ehegatte?.beschaeftigung,
    formData.ehegatte?.geburtsdatum,
    JSON.stringify(formData.kinder.map(k => [k.geburtsdatum, k.beschaeftigung])),
  ]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Lädt…</div>;
  }

  if (!session) {
    return <LoginForm />;
  }

  const handleSaveDraft = async () => {
    try {
      const app = await save({ applicationId, formData });
      setApplicationId(app.id);
      toast.success('Entwurf gespeichert.');
    } catch {
      toast.error('Konnte Entwurf nicht speichern.');
    }
  };
  
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      // Automatische Synchronisierung der KV-Nummer zur Mitglied-Versichertennummer
      if ('mitgliedKvNummer' in updates) {
        const normalizedKvNumber = normalizeInsuranceNumber(updates.mitgliedKvNummer);
        newData.mitgliedKvNummer = normalizedKvNumber;
        newData.mitgliedVersichertennummer = normalizedKvNumber;
      }
      
      // Automatische Synchronisierung des Bonus-Kontoinhabers mit Hauptmitglied-Name
      if ('mitgliedVorname' in updates || 'mitgliedName' in updates) {
        const oldFullName = `${prev.mitgliedVorname} ${prev.mitgliedName}`.trim();
        const newFullName = `${newData.mitgliedVorname} ${newData.mitgliedName}`.trim();

        if (!newData.viactivBonusKontoinhaber || newData.viactivBonusKontoinhaber === oldFullName) {
          newData.viactivBonusKontoinhaber = newFullName;
        }
        // BIG Kontoinhaber V + N separat (UI), und das kombinierte Feld wird für das PDF mitgeführt
        const bb = newData.bigBank;
        const ovn = prev.bigBank.kontoinhaberVorname || '';
        const onn = prev.bigBank.kontoinhaberNachname || '';
        const nextVn = (!bb.kontoinhaberVorname || bb.kontoinhaberVorname === prev.mitgliedVorname || bb.kontoinhaberVorname === ovn)
          ? newData.mitgliedVorname
          : bb.kontoinhaberVorname;
        const nextNn = (!bb.kontoinhaberNachname || bb.kontoinhaberNachname === prev.mitgliedName || bb.kontoinhaberNachname === onn)
          ? newData.mitgliedName
          : bb.kontoinhaberNachname;
        const combined = [nextVn, nextNn].filter(Boolean).join(' ').trim();
        newData.bigBank = {
          ...bb,
          kontoinhaberVorname: nextVn,
          kontoinhaberNachname: nextNn,
          kontoinhaber: combined,
        };
      }

      // Automatische Synchronisierung des Ortes (obere Anschrift → alle Ort-Folgefelder)
      if ('ort' in updates) {
        const oldOrt = prev.ort || '';
        const newOrt = (updates.ort as string) || '';
        // bigBank.ort (Ort der Unterschrift im BIG Plusbonus)
        if (!newData.bigBank.ort || newData.bigBank.ort === oldOrt) {
          newData.bigBank = { ...newData.bigBank, ort: newOrt };
        }
        // VIACTIV Arbeitgeber-Ort
        if (!newData.viactivArbeitgeber.ort || newData.viactivArbeitgeber.ort === oldOrt) {
          newData.viactivArbeitgeber = { ...newData.viactivArbeitgeber, ort: newOrt };
        }
        // Arzt-Orte (Rundum-Sicher-Paket)
        const rsp = newData.rundumSicherPaket;
        if (rsp) {
          const updatedRsp = { ...rsp };
          if (!updatedRsp.arztMitglied?.ort || updatedRsp.arztMitglied.ort === oldOrt) {
            updatedRsp.arztMitglied = { ...(updatedRsp.arztMitglied || { name: '', ort: '' }), ort: newOrt };
          }
          if (!updatedRsp.arztEhegatte?.ort || updatedRsp.arztEhegatte.ort === oldOrt) {
            updatedRsp.arztEhegatte = { ...(updatedRsp.arztEhegatte || { name: '', ort: '' }), ort: newOrt };
          }
          if (Array.isArray(updatedRsp.aerzteKinder)) {
            updatedRsp.aerzteKinder = updatedRsp.aerzteKinder.map(a =>
              !a?.ort || a.ort === oldOrt ? { ...(a || { name: '', ort: '' }), ort: newOrt } : a
            );
          }
          newData.rundumSicherPaket = updatedRsp;
        }
      }
      
      return newData;
    });
  };
  
  const handleModeChange = (mode: FormMode) => {
    updateFormData({ mode });
  };
  
  const getHeaderTitle = () => {
    switch (formData.selectedKrankenkasse) {
      case 'viactiv': return 'VIACTIV Formular';
      case 'novitas': return 'Novitas BKK Formular';
      case 'dak': return 'DAK Formular';
      case 'bkk_gs': return 'BKK GS Formular';
      case 'big_plusbonus': return 'BIG direkt gesund Formular';
      default: return 'Smart Formular';
    }
  };

  const getHeaderSubtitle = () => {
    switch (formData.selectedKrankenkasse) {
      case 'viactiv': return 'VIACTIV Krankenkasse - Beitrittserklärung';
      case 'novitas': return 'Novitas BKK - Familienversicherung';
      case 'dak': return 'DAK - Familienversicherung';
      case 'bkk_gs': return 'BKK GILDEMEISTER SEIDENSTICK - Online-Formular';
      case 'big_plusbonus': return formData.bigFamilienversicherung
        ? 'BIG direkt gesund - Familienversicherung + Plusbonus'
        : 'BIG direkt gesund - Plusbonus Antrag';
      default: return 'Bitte wählen Sie eine Krankenkasse aus';
    }
  };
  
  const handleExport = async () => {
    if (!formData.vertriebspartner || !formData.vertriebspartner.trim()) {
      toast.error('Bitte Vertriebspartner (VP) auswählen.');
      return;
    }
    // Basis-Validierung für alle Krankenkassen
    if (!formData.mitgliedName || !formData.mitgliedVorname) {
      toast.error('Bitte geben Sie Name und Vorname des Mitglieds ein.');
      return;
    }
    
    // Geburtsdatum ist Pflicht für alle Krankenkassen außer BIG-Plusbonus-Minimal (separat geprüft)
    if (formData.selectedKrankenkasse !== 'big_plusbonus' && !formData.mitgliedGeburtsdatum) {
      toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
      return;
    }
    
    // Unterschrift wird automatisch aus dem Nachnamen des Mitglieds erzeugt
    // (Nachname ist bereits Pflicht); kein zusätzlicher Check nötig.

    // BIG Plusbonus-spezifische Validierung
    if (formData.selectedKrankenkasse === 'big_plusbonus') {
      if (!formData.mitgliedStrasse || !formData.mitgliedHausnummer || !formData.mitgliedPlz || !formData.ort) {
        toast.error('Bitte vollständige Adresse (Straße, Hausnr., PLZ, Ort) eingeben.');
        return;
      }
      if (!formData.bigGeschlecht) {
        toast.error('Bitte wählen Sie das Geschlecht aus.');
        return;
      }
      const b = formData.bigBank;
      if (!b.kontoinhaber || !b.iban || !b.ort || !b.datum) {
        toast.error('Bitte Bankdaten (Kontoinhaber, IBAN, Ort, Datum) ausfüllen.');
        return;
      }
      if (formData.bigFamilienversicherung) {
        if (!formData.mitgliedKvNummer) { toast.error('Bitte KV-Nummer eingeben.'); return; }
        if (!formData.mitgliedKrankenkasse) { toast.error('Bitte Name der bisherigen Krankenkasse eingeben.'); return; }
        if (!formData.familienstand) { toast.error('Bitte Familienstand auswählen.'); return; }
        if (!formData.telefon || !formData.email) { toast.error('Telefon und E-Mail sind Pflicht.'); return; }
        if (!formData.mitgliedGeburtsdatum) { toast.error('Bitte Geburtsdatum des Mitglieds eingeben.'); return; }
        if (!formData.bigMitgliedBeschaeftigt) {
          toast.error('Bitte Beschäftigungsstatus des Hauptmitglieds (beschäftigt/arbeitslos) auswählen.');
          return;
        }
      }
      if (!formData.mitgliedGeburtsdatum) {
        toast.error('Bitte Geburtsdatum des Mitglieds eingeben (wird für den Dateinamen benötigt).');
        return;
      }
    }
    
    // VIACTIV-spezifische Validierung
    if (formData.selectedKrankenkasse === 'big_plusbonus') {
      // BIG Plusbonus: keine zusätzlichen Pflichtfelder (KV-Nr, Krankenkasse, Familienstand,
      // Telefon, Email, Geburtsdatum sind nicht erforderlich). Adresse + Bank wurden bereits
      // weiter oben validiert.
    }
    else if (formData.selectedKrankenkasse === 'viactiv') {
      if (!formData.ort) {
        toast.error('Bitte geben Sie den Ort ein.');
        return;
      }
      if (!formData.viactivGeschlecht) {
        toast.error('Bitte wählen Sie das Geschlecht aus.');
        return;
      }
      if (!formData.viactivBeschaeftigung) {
        toast.error('Bitte wählen Sie den Beschäftigungsstatus aus.');
        return;
      }
      if (!formData.viactivVersicherungsart) {
        toast.error('Bitte wählen Sie die bisherige Versicherungsart aus.');
        return;
      }
      // Bonus-Programm Validierung
      if (!formData.viactivBonusVertragsnummer) {
        toast.error('Bitte geben Sie die Antrags-/Vertragsnummer für das Bonus-Programm ein.');
        return;
      }
      if (!formData.viactivBonusIBAN) {
        toast.error('Bitte geben Sie die IBAN für das Bonus-Programm ein.');
        return;
      }
      if (!formData.viactivBonusKontoinhaber) {
        toast.error('Bitte geben Sie den Kontoinhaber für das Bonus-Programm ein.');
        return;
      }
    }
    // Novitas-spezifische Validierung
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
      if (!formData.mitgliedStrasse || !formData.mitgliedHausnummer || !formData.mitgliedPlz || !formData.ort) {
        toast.error('Bitte vollständige Adresse (Straße, Hausnr., PLZ, Ort) eingeben.');
        return;
      }
      if (!formData.mitgliedGeburtsort) {
        toast.error('Bitte geben Sie den Geburtsort ein.');
        return;
      }
      const ag = formData.viactivArbeitgeber;
      if (!ag?.name || !ag?.strasse || !ag?.plz || !ag?.ort || !formData.novitasArbeitsentgelt) {
        toast.error('Bitte Arbeitgeberdaten (Name, Anschrift, monatliches Arbeitsentgelt) vollständig eingeben.');
        return;
      }
      const nbank = formData.bigBank;
      if (!nbank?.kontoinhaber || !nbank?.iban) {
        toast.error('Bitte Bankverbindung (Kontoinhaber, IBAN) eingeben.');
        return;
      }
    }
    // DAK-spezifische Validierung
    else if (formData.selectedKrankenkasse === 'dak') {
      if (!formData.mitgliedKvNummer) {
        toast.error('Bitte geben Sie die KV-Nummer ein.');
        return;
      }
      if (!formData.mitgliedKrankenkasse) {
        toast.error('Bitte geben Sie den Namen der Krankenkasse ein.');
        return;
      }
      if (!formData.mitgliedGeburtsdatum) {
        toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
        return;
      }
    }
    // BKK GS-spezifische Validierung
    else {
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
      
      // Rundum-Sicher-Paket Validierung
      if (!formData.rundumSicherPaket.zusatzversicherung1) {
        toast.error('Bitte wählen Sie Zusatzversicherung 1 (Pflicht) aus.');
        return;
      }
      
      // Jahresbeitrag min. 300€
      const jahresbeitragClean = formData.rundumSicherPaket.jahresbeitrag.replace(/[€\s]/g, '').replace(',', '.');
      const jahresbeitragAmount = parseFloat(jahresbeitragClean);
      if (isNaN(jahresbeitragAmount) || jahresbeitragAmount < 300) {
        toast.error('Der Jahresbeitrag muss mindestens 300 € betragen.');
        return;
      }
      
      if (!formData.rundumSicherPaket.iban) {
        toast.error('Bitte geben Sie die IBAN ein.');
        return;
      }
      
      if (!formData.rundumSicherPaket.kontoinhaber) {
        toast.error('Bitte geben Sie den Namen des Kontoinhabers ein.');
        return;
      }
      
      // Datenschutz-Validierung
      if (!formData.rundumSicherPaket.datenschutz1 || !formData.rundumSicherPaket.datenschutz2) {
        toast.error('Bitte stimmen Sie den Datenschutzbestimmungen zu.');
        return;
      }
    }
    
    setIsExporting(true);
    let savedAppId = applicationId;
    let pdfCount = 0;
    try {
      // Remember last VP locally for convenience
      try { localStorage.setItem(VP_STORAGE_KEY, formData.vertriebspartner.trim()); } catch { /* ignore */ }
      // Auto-save before exporting so every export is tracked
      try {
        const app = await save({ applicationId, formData });
        savedAppId = app.id;
        if (!applicationId) setApplicationId(app.id);
      } catch {
        // Saving failure shouldn't block the PDF export
      }
      // BIG Plusbonus Export
      if (formData.selectedKrankenkasse === 'big_plusbonus') {
        const mitgliedChunks = Math.max(1, Math.ceil(formData.bigMitversicherte.length / 3));
        let ownMembershipPersons = 0;
        if (formData.bigFamilienversicherung) {
          const e = formData.ehegatte;
          if (e && (e.eigeneMitgliedschaft === true || e.bisherigArt === 'mitgliedschaft') && (e.vorname || e.name)) {
            ownMembershipPersons += 1;
          }
          ownMembershipPersons += formData.kinder.filter(k =>
            (k.eigeneMitgliedschaft === true || k.bisherigArt === 'mitgliedschaft') && (k.vorname || k.name)
          ).length;
        }
        const plusbonusParts = mitgliedChunks + ownMembershipPersons;
        if (formData.bigFamilienversicherung) {
          toast.info('BIG Familienversicherung + Plusbonus PDFs werden erstellt...');
          await exportBigFamilienversicherung(formData);
          await exportBigPlusbonus(formData);
          const famversParts = Math.max(1, Math.ceil(Math.max(1, formData.kinder.length) / 3));
          pdfCount = famversParts + plusbonusParts;
          toast.success('BIG PDFs erfolgreich exportiert!');
        } else {
          toast.info('BIG direkt gesund Plusbonus PDF wird erstellt...');
          await exportBigPlusbonus(formData);
          pdfCount = plusbonusParts;
          toast.success('BIG Plusbonus PDF erfolgreich exportiert!');
        }
      }
      // VIACTIV Export
      else if (formData.selectedKrankenkasse === 'viactiv') {
        if (formData.viactivFamilienangehoerigeMitversichern) {
          // Berechne Anzahl der PDFs inkl. eigener Mitgliedschaft für Kinder
          const kinderMitEigenerMitgliedschaft = formData.kinder.filter(k => k.eigeneMitgliedschaft).length;
          const familienversicherteKinder = formData.kinder.length - kinderMitEigenerMitgliedschaft;
          
          const numberOfFamilyPDFs = familienversicherteKinder > 0 || formData.ehegatte.name 
            ? Math.max(1, Math.ceil(familienversicherteKinder / 3)) 
            : 0;
          
          const hasSpouseWithOwnMembership = formData.ehegatte.name && formData.ehegatte.bisherigArt === 'mitgliedschaft';
          const numberOfBEs = 1 + (hasSpouseWithOwnMembership ? 1 : 0) + kinderMitEigenerMitgliedschaft;
          const numberOfBonusPDFs = 1 + (formData.ehegatte.name ? 1 : 0) + formData.kinder.length;
          
          toast.info(`Es werden ${numberOfBEs} Beitrittserklärung(en), ${numberOfFamilyPDFs} Familienversicherungs-PDF(s) und ${numberOfBonusPDFs} Bonus-PDF(s) erstellt...`);
          await exportViactivBeitrittserklaerung(formData);
          await exportViactivFamilienversicherung(formData);
          await exportViactivBonusPDFs(formData);
          pdfCount = numberOfBEs + numberOfFamilyPDFs + numberOfBonusPDFs;
        } else {
          toast.info('VIACTIV Beitrittserklärung und Bonus-PDF werden erstellt...');
          await exportViactivBeitrittserklaerung(formData);
          await exportViactivBonusPDFs(formData);
          pdfCount = 2;
        }
        toast.success('VIACTIV PDF(s) erfolgreich exportiert!');
      }
      // Novitas BKK Export
      else if (formData.selectedKrankenkasse === 'novitas') {
        const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 3));
        toast.info(`Es werden ${numberOfPDFs} Novitas Familienversicherungs-PDF(s) erstellt...`);
        await exportNovitasFamilienversicherung(formData);
        pdfCount = numberOfPDFs;
        toast.success('Novitas BKK Familienversicherung erfolgreich exportiert!');
      }
      // DAK Export
      else if (formData.selectedKrankenkasse === 'dak') {
        const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 2)); // Nur 2 Kinder pro PDF!
        toast.info(`Es werden ${numberOfPDFs} DAK Familienversicherungs-PDF(s) erstellt...`);
        await exportDAKFamilienversicherung(formData);
        pdfCount = numberOfPDFs;
        toast.success('DAK Familienversicherung erfolgreich exportiert!');
      }
      // BKK GS Export
      else {
        if (formData.mode === 'nur_rundum') {
          toast.info('Es wird 1 Rundum-Sicher-Paket-PDF erstellt.');
          await exportRundumSicherPaketOnly(formData);
          pdfCount = 1;
        } else {
          const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 3));
          const numberOfRundumPDFs = 1 + (formData.ehegatte.name ? 1 : 0) + formData.kinder.length;
          toast.info(`Es werden ${numberOfPDFs} Familienversicherungs-PDF(s) und ${numberOfRundumPDFs} Rundum-Sicher-Paket-PDF(s) erstellt.`);
          await exportFilledPDF(formData);
          pdfCount = numberOfPDFs + numberOfRundumPDFs;
        }
        toast.success('PDF erfolgreich exportiert!');
      }
      if (savedAppId) {
        try { await markExported(savedAppId, pdfCount); } catch { /* non-blocking */ }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Fehler beim Exportieren des PDFs. Bitte versuchen Sie es erneut.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky glass top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 glass-bar">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-hero text-primary-foreground flex items-center justify-center shadow-card shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base md:text-lg font-semibold leading-tight truncate">
                {getHeaderTitle()}
              </div>
              <div className="text-xs text-muted-foreground truncate hidden sm:block">
                {getHeaderSubtitle()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <DocumentMergeDialog />
            <FreitextImportDialog formData={formData} setFormData={setFormData} currentMode={formData.mode} selectedKrankenkasse={formData.selectedKrankenkasse} />
            <JsonImportDialog formData={formData} setFormData={setFormData} currentMode={formData.mode} selectedKrankenkasse={formData.selectedKrankenkasse} />
            <div className="w-px h-6 bg-border/70 mx-1 hidden md:block" />
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title="Meine Anträge">
              <Link to="/antraege"><Archive className="h-4 w-4" /><span className="hidden md:inline ml-1">Anträge</span></Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title="Admin">
                <Link to="/admin"><Settings className="h-4 w-4" /><span className="hidden md:inline ml-1">Admin</span></Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title="E-Mail-Empfänger">
                <Link to="/empfaenger"><Mail className="h-4 w-4" /><span className="hidden md:inline ml-1">E-Mail</span></Link>
              </Button>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="text-muted-foreground hover:text-foreground"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline ml-1">Abmelden</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero / context strip */}
      <div className="bg-gradient-surface border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-full mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Smart-Antrag
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {formData.selectedKrankenkasse ? getHeaderSubtitle() : 'Bitte wählen Sie eine Krankenkasse'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              <AlertCircle className="inline h-4 w-4 mr-1 -mt-0.5 text-accent" />
              Automatisch ausgefüllt: bisherige Versicherung, Anlass, Beginn (+3 Monate), Informationsblatt — und vieles mehr.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
        {/* Side TOC (desktop only) */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">
              Abschnitte
            </div>
            {[
              { id: 'sec-krankenkasse', label: 'Krankenkasse' },
              ...(formData.selectedKrankenkasse ? [{ id: 'sec-mitglied', label: 'Mitglied' }] : []),
              ...(formData.selectedKrankenkasse && !(formData.selectedKrankenkasse === 'big_plusbonus' && !formData.bigFamilienversicherung) && !(formData.selectedKrankenkasse === 'bkk_gs' && formData.mode === 'nur_rundum') ? [
                { id: 'sec-ehegatte', label: 'Ehegatte' },
                { id: 'sec-kinder', label: 'Kinder' },
              ] : []),
              ...(formData.selectedKrankenkasse === 'bkk_gs' ? [{ id: 'sec-rundum', label: 'Rundum-Sicher' }] : []),
              ...(formData.selectedKrankenkasse === 'big_plusbonus' ? [{ id: 'sec-bigplus', label: 'Plusbonus' }] : []),
              ...(formData.selectedKrankenkasse ? [{ id: 'sec-signature', label: 'Unterschrift' }] : []),
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors group"
              >
                <span>{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </nav>
        </aside>

        <div>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
          {/* Krankenkassen-Auswahl */}
          <div id="sec-krankenkasse" className="bg-card rounded-2xl shadow-card border border-border/60 p-6 mb-4 scroll-mt-24 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold leading-tight">Krankenkasse auswählen</h2>
                <p className="text-xs text-muted-foreground">Das Formular passt sich automatisch an.</p>
              </div>
            </div>
            <Select
              value={formData.selectedKrankenkasse}
              onValueChange={(value) => updateFormData({ selectedKrankenkasse: value as Krankenkasse })}
            >
              <SelectTrigger className="w-full md:w-96">
                <SelectValue placeholder="Krankenkasse auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {KRANKENKASSEN_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-3">
              {formData.selectedKrankenkasse === 'big_plusbonus'
                ? (formData.bigFamilienversicherung
                    ? 'Es werden BIG Familienversicherung + Plusbonus-Antrag erstellt.'
                    : 'Es wird der BIG direkt gesund Plusbonus-Antrag erstellt.')
                : formData.selectedKrankenkasse === 'dak' 
                ? 'Es wird die DAK Familienversicherung erstellt.'
                : formData.selectedKrankenkasse === 'novitas' 
                  ? 'Es wird die Novitas BKK Familienversicherung erstellt.'
                  : formData.selectedKrankenkasse === 'viactiv' 
                    ? 'Es wird die VIACTIV Beitrittserklärung erstellt.'
                    : 'Es werden BKK GS Familienversicherung und Rundum-Sicher-Paket erstellt.'}
            </p>

            {/* Vertriebspartner — Pflichtfeld nur für Antragsliste, nicht im PDF */}
            <div className="mt-5 pt-5 border-t border-border/60">
              <Label className="text-sm font-medium flex items-center gap-2">
                Vertriebspartner (VP) <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Wird nur intern in der Antragsliste angezeigt, nicht im PDF.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={vpMode === 'custom' ? CUSTOM_VP_VALUE : (formData.vertriebspartner || '')}
                  onValueChange={(value) => {
                    if (value === CUSTOM_VP_VALUE) {
                      setVpMode('custom');
                      updateFormData({ vertriebspartner: '' });
                    } else {
                      setVpMode('preset');
                      updateFormData({ vertriebspartner: value });
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="VP auswählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERTRIEBSPARTNER_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_VP_VALUE}>Eigener VP…</SelectItem>
                  </SelectContent>
                </Select>
                {vpMode === 'custom' && (
                  <Input
                    placeholder="Eigene VP-Bezeichnung"
                    value={formData.vertriebspartner}
                    onChange={(e) => updateFormData({ vertriebspartner: e.target.value })}
                    className="w-full sm:w-72"
                  />
                )}
              </div>
            </div>
          </div>
          
          {/* Formular-Sektionen nur anzeigen wenn Krankenkasse gewählt */}
          {formData.selectedKrankenkasse && (
            <>
              {/* Modus-Auswahl (nur für BKK GS) */}
              {formData.selectedKrankenkasse === 'bkk_gs' && (
                <div className="bg-card rounded-2xl shadow-card border border-border/60 p-6 mb-4 animate-fade-in-up">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Formular-Modus auswählen
                  </h2>
                  <RadioGroup
                    value={formData.mode}
                    onValueChange={(value) => handleModeChange(value as FormMode)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="mode-family"
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.mode === 'familienversicherung_und_rundum'
                          ? 'border-primary bg-primary/5 shadow-card'
                          : 'border-border hover:border-accent/60'
                      }`}
                    >
                      <RadioGroupItem value="familienversicherung_und_rundum" id="mode-family" className="mt-1" />
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <Users className="h-4 w-4 text-primary" />
                          Familienversicherung + Rundum-Sicher-Paket
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Für Mitglied mit Ehegatte und/oder Kindern. Erstellt beide PDF-Typen.
                        </p>
                      </div>
                    </Label>
                    <Label
                      htmlFor="mode-single"
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.mode === 'nur_rundum'
                          ? 'border-primary bg-primary/5 shadow-card'
                          : 'border-border hover:border-accent/60'
                      }`}
                    >
                      <RadioGroupItem value="nur_rundum" id="mode-single" className="mt-1" />
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <User className="h-4 w-4 text-primary" />
                          Nur Rundum-Sicher-Paket
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Nur für das Mitglied selbst. Keine Familienangehörigen erforderlich.
                        </p>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>
              )}
              
              {/* BIG: Antrags-Variante zuerst abfragen */}
              {formData.selectedKrankenkasse === 'big_plusbonus' && (
                <div id="sec-big-variante">
                  <BigPlusbonusSection formData={formData} updateFormData={updateFormData} mode="variante" />
                </div>
              )}

              <div id="sec-mitglied"><MemberSection formData={formData} updateFormData={updateFormData} /></div>
              
              {/* BKK GS spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'bkk_gs' && (
                <>
                  {formData.mode === 'familienversicherung_und_rundum' && (
                    <>
                      <div id="sec-ehegatte"><SpouseSection formData={formData} updateFormData={updateFormData} /></div>
                      <div id="sec-kinder"><ChildrenSection formData={formData} updateFormData={updateFormData} /></div>
                    </>
                  )}
                  <div id="sec-rundum"><RundumSicherPaketSection formData={formData} updateFormData={updateFormData} /></div>
                </>
              )}
              
              {/* VIACTIV-spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'viactiv' && (
                <div id="sec-ehegatte"><ViactivSection formData={formData} updateFormData={updateFormData} /></div>
              )}
              
              {/* Novitas BKK spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'novitas' && (
                <>
                  <div className="bg-card rounded-2xl shadow-card border border-border/60 p-6 mb-4 animate-fade-in-up">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Antragsvariante wählen
                    </h2>
                    <RadioGroup
                      value={formData.novitasMode ?? 'familie'}
                      onValueChange={(value) => updateFormData({ novitasMode: value as 'einzeln' | 'familie' })}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <Label
                        htmlFor="novitas-mode-familie"
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          (formData.novitasMode ?? 'familie') === 'familie'
                            ? 'border-primary bg-primary/5 shadow-card'
                            : 'border-border hover:border-accent/60'
                        }`}
                      >
                        <RadioGroupItem value="familie" id="novitas-mode-familie" className="mt-1" />
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            <Users className="h-4 w-4 text-primary" /> Familienversicherung
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Hauptmitglied + Ehegatte + Kinder. Bei Jobcenter erhalten Ehegatte und Kinder ≥ 16 automatisch eine eigene Mitgliedschaft.
                          </p>
                        </div>
                      </Label>
                      <Label
                        htmlFor="novitas-mode-einzeln"
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.novitasMode === 'einzeln'
                            ? 'border-primary bg-primary/5 shadow-card'
                            : 'border-border hover:border-accent/60'
                        }`}
                      >
                        <RadioGroupItem value="einzeln" id="novitas-mode-einzeln" className="mt-1" />
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            <User className="h-4 w-4 text-primary" /> Einzelperson
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Nur das Hauptmitglied. Ehegatte und Kinder werden im Antrag ausgeblendet.
                          </p>
                        </div>
                      </Label>
                    </RadioGroup>
                    <div className="mt-4 pt-4 border-t border-border/40">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-border accent-primary"
                          checked={!!formData.novitasBonus400}
                          onChange={(e) => updateFormData({ novitasBonus400: e.target.checked })}
                        />
                        <div>
                          <div className="font-medium">Kunde wünscht Bonus in Höhe von 400€</div>
                          <p className="text-sm text-muted-foreground mt-1">
                            (300€ + 100€) — Aktiviert eine separate E-Mail-Vorlage an Stefanie und sendet den Antrag als „NovitasBKK_Beitritt.pdf" an die WhatsApp-Gruppe.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                  {(formData.novitasMode ?? 'familie') === 'familie' && (
                    <>
                      <div id="sec-ehegatte"><SpouseSection formData={formData} updateFormData={updateFormData} /></div>
                      <div id="sec-kinder"><ChildrenSection formData={formData} updateFormData={updateFormData} /></div>
                    </>
                  )}
                  {/* Novitas: Arbeitgeber + Bank für Hauptmitglied und jede eigene Mitgliedschaft */}
                  <div id="sec-novitas-ag-bank" className="space-y-4">
                    {splitNovitasPersons(formData).filter(p => p.ownMembership).map((p) => {
                      if (p.role === 'main') {
                        const val: NovitasEmployerBankValue = {
                          arbeitgeber: formData.viactivArbeitgeber ?? createEmptyArbeitgeberDaten(),
                          arbeitsentgelt: formData.novitasArbeitsentgelt,
                          bank: {
                            kontoinhaber: formData.bigBank?.kontoinhaber ?? '',
                            iban: formData.bigBank?.iban ?? '',
                          },
                        };
                        return (
                          <NovitasEmployerBank
                            key="main"
                            title={`Arbeitgeber & Bank — ${p.label}`}
                            idPrefix="novitas-main"
                            value={val}
                            onChange={(u) => updateFormData({
                              ...(u.arbeitgeber ? { viactivArbeitgeber: { ...(formData.viactivArbeitgeber ?? createEmptyArbeitgeberDaten()), ...u.arbeitgeber } } : {}),
                              ...(u.arbeitsentgelt !== undefined ? { novitasArbeitsentgelt: u.arbeitsentgelt } : {}),
                              ...(u.bank ? { bigBank: { ...formData.bigBank, ...u.bank } } : {}),
                            })}
                            autofilledHint={(formData.viactivBeschaeftigung === 'al_geld_2' || formData.viactivBeschaeftigung === 'al_geld_1')
                              ? 'Bei Bezug von Jobcenter/Agentur für Arbeit bitte hier den Namen und die Anschrift der Behörde eintragen.'
                              : undefined}
                          />
                        );
                      }
                      const isSpouse = p.role === 'ehegatte';
                      const idx = p.index ? p.index - 1 : 0;
                      const person = isSpouse ? formData.ehegatte : formData.kinder[idx];
                      if (!person) return null;
                      const val: NovitasEmployerBankValue = {
                        arbeitgeber: person.novitasArbeitgeber ?? createEmptyArbeitgeberDaten(),
                        arbeitsentgelt: person.novitasArbeitsentgelt ?? '',
                        bank: person.novitasBank ?? { kontoinhaber: '', iban: '' },
                      };
                      const onChange = (u: Partial<NovitasEmployerBankValue>) => {
                        const merged = {
                          ...person,
                          ...(u.arbeitgeber ? { novitasArbeitgeber: { ...(person.novitasArbeitgeber ?? createEmptyArbeitgeberDaten()), ...u.arbeitgeber } } : {}),
                          ...(u.arbeitsentgelt !== undefined ? { novitasArbeitsentgelt: u.arbeitsentgelt } : {}),
                          ...(u.bank ? { novitasBank: { ...(person.novitasBank ?? { kontoinhaber: '', iban: '' }), ...u.bank } } : {}),
                        };
                        if (isSpouse) updateFormData({ ehegatte: merged });
                        else {
                          const next = [...formData.kinder];
                          next[idx] = merged;
                          updateFormData({ kinder: next });
                        }
                      };
                      return (
                        <NovitasEmployerBank
                          key={`${p.role}-${p.index ?? 0}`}
                          title={`Arbeitgeber & Bank — ${p.label} (eigene Mitgliedschaft)`}
                          idPrefix={`novitas-${p.role}-${p.index ?? 0}`}
                          value={val}
                          onChange={onChange}
                        />
                      );
                    })}
                  </div>
                </>
              )}
              
              {/* DAK spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'dak' && (
                <>
                  <div id="sec-ehegatte"><SpouseSection formData={formData} updateFormData={updateFormData} /></div>
                  <div id="sec-kinder"><ChildrenSection formData={formData} updateFormData={updateFormData} /></div>
                </>
              )}
              
              {/* BIG direkt gesund (Plusbonus) spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'big_plusbonus' && (
                <>
                  {formData.bigFamilienversicherung && (
                    <>
                      <div id="sec-ehegatte"><SpouseSection formData={formData} updateFormData={updateFormData} /></div>
                      <div id="sec-kinder"><ChildrenSection formData={formData} updateFormData={updateFormData} /></div>
                    </>
                  )}
                  <div id="sec-bigplus"><BigPlusbonusSection formData={formData} updateFormData={updateFormData} mode="main" /></div>
                </>
              )}

              <div id="sec-signature"><SignatureSection formData={formData} updateFormData={updateFormData} /></div>
              
              {/* Export Button */}
              <div className="sticky bottom-4 pt-4 z-30">
                <div className="glass-bar rounded-2xl shadow-elevated border border-border/70 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-center md:text-left flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {applicationId ? 'Antrag wird aktualisiert' : 'Bereit zum Exportieren?'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Jeder Export wird verschlüsselt gespeichert und im Audit-Log erfasst.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={saving || isExporting}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Speichere…' : applicationId ? 'Aktualisieren' : 'Entwurf speichern'}
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleExport}
                      disabled={isExporting || !formData.vertriebspartner?.trim()}
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-card"
                    >
                      <FileDown className="h-5 w-5" />
                      {isExporting ? 'Exportiere…' : 'PDF Exportieren'}
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={async () => {
                        if (!formData.vertriebspartner?.trim()) { toast.error('Bitte Vertriebspartner wählen.'); return; }
                        if (!formData.selectedKrankenkasse) { toast.error('Bitte Krankenkasse wählen.'); return; }
                        // auto-save first so audit event has an application_id
                        try {
                          const app = await save({ applicationId, formData });
                          if (!applicationId) setApplicationId(app.id);
                        } catch { /* ignore */ }
                        setEmailDialogOpen(true);
                      }}
                      disabled={isExporting || !formData.vertriebspartner?.trim() || !formData.selectedKrankenkasse}
                      className="gap-2"
                    >
                      <Mail className="h-5 w-5" />
                      Per E-Mail senden
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
        </div>
      </main>

      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        formData={formData}
        applicationId={applicationId}
        bearbeiter={session?.user?.user_metadata?.display_name || session?.user?.email || ''}
      />
      
      {/* Footer */}
      <footer className="border-t border-border/60 py-6 px-4 mt-8">
        <div className="max-w-6xl mx-auto text-center text-xs text-muted-foreground">
          Smart-Formular · Unterstützt das Ausfüllen von Krankenkassen-Anträgen.
        </div>
      </footer>
    </div>
  );
};

export default Index;
