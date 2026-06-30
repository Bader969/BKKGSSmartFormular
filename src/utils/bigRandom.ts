// Zufallswerte für BIG Plusbonus
//  - Police-Beträge pro Position: ganzzahlig zwischen 200 und 245 (inkl.)
//  - Eigener Anteil (für Hauptmitglied) wird einmal beim ersten Bedarf
//    erzeugt und persistent im FormData abgelegt, damit sich der Wert
//    nicht bei jedem Render ändert.

export const randomPoliceBetrag = (): string => {
  const min = 200;
  const max = 245;
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(n);
};

/** Parst einen Eurowert wie "210" oder "210,00" → Zahl oder 0. */
export const parseEuro = (v: string | undefined | null): number => {
  if (!v) return 0;
  const cleaned = String(v).replace(/[€\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};