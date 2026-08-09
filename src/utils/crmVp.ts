/**
 * CRM (Vermittlersuite) – Zuordnung Vertriebspartner → Berater/Erfasser/Besitzer.
 * Nur Anträge dieser VP werden ins CRM übertragen.
 */
export const CRM_VP_ADVISOR: Record<string, string> = {
  'AD Blitzvox': 'Adam',
  'AM Blitzvox': 'Ammar',
  'BA Blitzvox': 'Bashar Yahia',
  'EM AM Blitzvox': 'Ammar',
  'EM HZ Blitzvox': 'Hamza',
  'GH Blitzvox': 'Gheith',
  'HZ Blitzvox': 'Hamza',
  'JA Blitzvox': 'Jamil',
};

const NORM_VP_ADVISOR: Record<string, string> = Object.fromEntries(
  Object.entries(CRM_VP_ADVISOR).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, ' '), v]),
);

/** Case-insensitive Lookup (z. B. "JA BlitzVox" == "JA Blitzvox"). */
export const crmAdvisorForVp = (vp?: string | null): string | null => {
  if (!vp) return null;
  const key = vp.trim().toLowerCase().replace(/\s+/g, ' ');
  return NORM_VP_ADVISOR[key] ?? null;
};

export const isCrmEligibleVp = (vp?: string | null): boolean => !!crmAdvisorForVp(vp);

/** Quelle für neu angelegte Kunden im CRM. */
export const CRM_LEAD_SOURCE = 'sonstiges';
export const CRM_LEAD_SOURCE_DETAIL = 'GKV-Kampagne';