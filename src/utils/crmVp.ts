/**
 * CRM-Zuordnung: Vertriebspartner → Ziel-CRM + Berater/Erfasser/Besitzer.
 * Nur Anträge mit zugeordnetem VP werden ins CRM übertragen.
 */
export type CrmTarget = 'blitzvox' | 'beitplus';

export const CRM_TARGET_LABEL: Record<CrmTarget, string> = {
  blitzvox: 'BlitzVox CRM',
  beitplus: 'BeitPlus CRM',
};

/** Blitzvox CRM */
export const BLITZVOX_VP_ADVISOR: Record<string, string> = {
  'AD Blitzvox': 'Adam',
  'AM Blitzvox': 'Ammar',
  'BA Blitzvox': 'Bashar Yahia',
  'EM AM Blitzvox': 'Ammar',
  'EM HZ Blitzvox': 'Hamza',
  'GH Blitzvox': 'Gheith',
  'HZ Blitzvox': 'Hamza',
  'JA Blitzvox': 'Jamil',
};

/** BeitPlus CRM (Liste erweiterbar) */
export const BEITPLUS_VP_ADVISOR: Record<string, string> = {
  'Gheith Abojamil': 'Gheith Abojamil',
};

/** Rückwärtskompatibel: alle VP-Codes über beide CRMs. */
export const CRM_VP_ADVISOR: Record<string, string> = {
  ...BLITZVOX_VP_ADVISOR,
  ...BEITPLUS_VP_ADVISOR,
};

const normVp = (vp: string) => vp.trim().toLowerCase().replace(/\s+/g, ' ');

const NORM_BLITZVOX: Record<string, string> = Object.fromEntries(
  Object.entries(BLITZVOX_VP_ADVISOR).map(([k, v]) => [normVp(k), v]),
);
const NORM_BEITPLUS: Record<string, string> = Object.fromEntries(
  Object.entries(BEITPLUS_VP_ADVISOR).map(([k, v]) => [normVp(k), v]),
);

/** Ziel-CRM aus dem Vertriebspartner ableiten (null = keine Zuordnung). */
export const crmTargetForVp = (vp?: string | null): CrmTarget | null => {
  if (!vp) return null;
  const key = normVp(vp);
  if (NORM_BLITZVOX[key]) return 'blitzvox';
  if (NORM_BEITPLUS[key]) return 'beitplus';
  if (key.includes('blitzvox')) return 'blitzvox';
  if (key.includes('beitplus') || key.includes('beit plus')) return 'beitplus';
  return null;
};

/** Case-insensitive Berater-Lookup über beide CRMs. */
export const crmAdvisorForVp = (vp?: string | null): string | null => {
  if (!vp) return null;
  const key = normVp(vp);
  return NORM_BLITZVOX[key] ?? NORM_BEITPLUS[key] ?? null;
};

export const isCrmEligibleVp = (vp?: string | null): boolean =>
  !!crmAdvisorForVp(vp) || !!crmTargetForVp(vp);

/** Quelle für neu angelegte Kunden im CRM. */
export const CRM_LEAD_SOURCE = 'sonstiges';
export const CRM_LEAD_SOURCE_DETAIL = 'GKV-Kampagne';
