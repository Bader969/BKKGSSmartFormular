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

export const crmAdvisorForVp = (vp?: string | null): string | null =>
  (vp && CRM_VP_ADVISOR[vp.trim()]) || null;

export const isCrmEligibleVp = (vp?: string | null): boolean => !!crmAdvisorForVp(vp);

/** Quelle für neu angelegte Kunden im CRM. */
export const CRM_LEAD_SOURCE = 'sonstiges';
export const CRM_LEAD_SOURCE_DETAIL = 'GKV-Kampagne';