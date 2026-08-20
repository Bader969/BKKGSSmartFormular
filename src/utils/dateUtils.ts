export const formatDateGerman = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseGermanDate = (dateStr: string): Date | null => {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

export const getBeginDate = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 3, 1);
};

export const getEndDate = (beginDate: Date): Date => {
  return new Date(beginDate.getFullYear(), beginDate.getMonth(), 0);
};

/**
 * Manuelle Überschreibungen der automatischen Termine (leer = Automatik).
 * Werte immer als ISO-String YYYY-MM-DD.
 */
export interface FormDateOverrides {
  versicherungsbeginnManuell?: string;
  bisherigeVersicherungEndeManuell?: string;
  antragsdatumManuell?: string;
}

const parseIsoDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Einziger Auflösungspunkt für alle automatischen Termine.
 * Ohne manuelle Eingaben identisch zur bisherigen Berechnung
 * (Beginn = 01. des Monats in 3 Monaten, Ende = Tag davor, Datum = heute).
 */
export const resolveFormDates = (overrides?: FormDateOverrides | null) => {
  const manualBegin = parseIsoDate(overrides?.versicherungsbeginnManuell);
  const manualEnd = parseIsoDate(overrides?.bisherigeVersicherungEndeManuell);
  const manualToday = parseIsoDate(overrides?.antragsdatumManuell);

  const beginObj = manualBegin ?? getBeginDate();
  const endObj = manualEnd ?? getEndDate(beginObj);
  const todayObj = manualToday ?? new Date();

  return {
    beginObj,
    endObj,
    todayObj,
    beginDate: formatDateGerman(beginObj),
    endDate: formatDateGerman(endObj),
    today: formatDateGerman(todayObj),
    beginForInput: formatDateForInput(beginObj),
    endForInput: formatDateForInput(endObj),
    todayForInput: formatDateForInput(todayObj),
    isManual: {
      begin: !!manualBegin,
      end: !!manualEnd,
      today: !!manualToday,
    },
  };
};

export const calculateDates = (overrides?: FormDateOverrides | null) => {
  const r = resolveFormDates(overrides);
  return {
    today: r.today,
    todayForInput: r.todayForInput,
    beginDate: r.beginDate,
    endDate: r.endDate,
  };
};
