/**
 * Liste der Länder mit ISO 3166-1 Alpha-2 Codes und Staatsangehörigkeiten
 * Sortiert nach Häufigkeit (Deutschland zuerst, dann alphabetisch)
 */
export interface Country {
  code: string;
  name: string;
  nationality: string; // Staatsangehörigkeit als Adjektiv
}

export const countries: Country[] = [
  { code: "DE", name: "Deutschland", nationality: "Deutsch" },
  { code: "TR", name: "Türkei", nationality: "Türkisch" },
  { code: "SY", name: "Syrien", nationality: "Syrisch" },
  { code: "PL", name: "Polen", nationality: "Polnisch" },
  { code: "RU", name: "Russland", nationality: "Russisch" },
  { code: "UA", name: "Ukraine", nationality: "Ukrainisch" },
  { code: "RO", name: "Rumänien", nationality: "Rumänisch" },
  { code: "IT", name: "Italien", nationality: "Italienisch" },
  { code: "GR", name: "Griechenland", nationality: "Griechisch" },
  { code: "HR", name: "Kroatien", nationality: "Kroatisch" },
  { code: "RS", name: "Serbien", nationality: "Serbisch" },
  { code: "BG", name: "Bulgarien", nationality: "Bulgarisch" },
  { code: "HU", name: "Ungarn", nationality: "Ungarisch" },
  { code: "AT", name: "Österreich", nationality: "Österreichisch" },
  { code: "CH", name: "Schweiz", nationality: "Schweizerisch" },
  { code: "NL", name: "Niederlande", nationality: "Niederländisch" },
  { code: "BE", name: "Belgien", nationality: "Belgisch" },
  { code: "FR", name: "Frankreich", nationality: "Französisch" },
  { code: "ES", name: "Spanien", nationality: "Spanisch" },
  { code: "PT", name: "Portugal", nationality: "Portugiesisch" },
  { code: "GB", name: "Großbritannien", nationality: "Britisch" },
  { code: "IE", name: "Irland", nationality: "Irisch" },
  { code: "CZ", name: "Tschechien", nationality: "Tschechisch" },
  { code: "SK", name: "Slowakei", nationality: "Slowakisch" },
  { code: "SI", name: "Slowenien", nationality: "Slowenisch" },
  { code: "BA", name: "Bosnien und Herzegowina", nationality: "Bosnisch" },
  { code: "ME", name: "Montenegro", nationality: "Montenegrinisch" },
  { code: "MK", name: "Nordmazedonien", nationality: "Mazedonisch" },
  { code: "AL", name: "Albanien", nationality: "Albanisch" },
  { code: "XK", name: "Kosovo", nationality: "Kosovarisch" },
  { code: "MD", name: "Moldawien", nationality: "Moldauisch" },
  { code: "BY", name: "Belarus", nationality: "Belarussisch" },
  { code: "LT", name: "Litauen", nationality: "Litauisch" },
  { code: "LV", name: "Lettland", nationality: "Lettisch" },
  { code: "EE", name: "Estland", nationality: "Estnisch" },
  { code: "FI", name: "Finnland", nationality: "Finnisch" },
  { code: "SE", name: "Schweden", nationality: "Schwedisch" },
  { code: "NO", name: "Norwegen", nationality: "Norwegisch" },
  { code: "DK", name: "Dänemark", nationality: "Dänisch" },
  { code: "AF", name: "Afghanistan", nationality: "Afghanisch" },
  { code: "IQ", name: "Irak", nationality: "Irakisch" },
  { code: "IR", name: "Iran", nationality: "Iranisch" },
  { code: "LB", name: "Libanon", nationality: "Libanesisch" },
  { code: "JO", name: "Jordanien", nationality: "Jordanisch" },
  { code: "PS", name: "Palästina", nationality: "Palästinensisch" },
  { code: "EG", name: "Ägypten", nationality: "Ägyptisch" },
  { code: "MA", name: "Marokko", nationality: "Marokkanisch" },
  { code: "TN", name: "Tunesien", nationality: "Tunesisch" },
  { code: "DZ", name: "Algerien", nationality: "Algerisch" },
  { code: "LY", name: "Libyen", nationality: "Libysch" },
  { code: "ER", name: "Eritrea", nationality: "Eritreisch" },
  { code: "ET", name: "Äthiopien", nationality: "Äthiopisch" },
  { code: "SO", name: "Somalia", nationality: "Somalisch" },
  { code: "NG", name: "Nigeria", nationality: "Nigerianisch" },
  { code: "GH", name: "Ghana", nationality: "Ghanaisch" },
  { code: "CM", name: "Kamerun", nationality: "Kamerunisch" },
  { code: "CD", name: "Kongo (Dem. Rep.)", nationality: "Kongolesisch" },
  { code: "ZA", name: "Südafrika", nationality: "Südafrikanisch" },
  { code: "KE", name: "Kenia", nationality: "Kenianisch" },
  { code: "IN", name: "Indien", nationality: "Indisch" },
  { code: "PK", name: "Pakistan", nationality: "Pakistanisch" },
  { code: "BD", name: "Bangladesch", nationality: "Bangladeschisch" },
  { code: "LK", name: "Sri Lanka", nationality: "Sri-Lankisch" },
  { code: "CN", name: "China", nationality: "Chinesisch" },
  { code: "JP", name: "Japan", nationality: "Japanisch" },
  { code: "KR", name: "Südkorea", nationality: "Südkoreanisch" },
  { code: "VN", name: "Vietnam", nationality: "Vietnamesisch" },
  { code: "TH", name: "Thailand", nationality: "Thailändisch" },
  { code: "PH", name: "Philippinen", nationality: "Philippinisch" },
  { code: "ID", name: "Indonesien", nationality: "Indonesisch" },
  { code: "MY", name: "Malaysia", nationality: "Malaysisch" },
  { code: "US", name: "USA", nationality: "US-Amerikanisch" },
  { code: "CA", name: "Kanada", nationality: "Kanadisch" },
  { code: "MX", name: "Mexiko", nationality: "Mexikanisch" },
  { code: "BR", name: "Brasilien", nationality: "Brasilianisch" },
  { code: "AR", name: "Argentinien", nationality: "Argentinisch" },
  { code: "CL", name: "Chile", nationality: "Chilenisch" },
  { code: "CO", name: "Kolumbien", nationality: "Kolumbianisch" },
  { code: "VE", name: "Venezuela", nationality: "Venezolanisch" },
  { code: "PE", name: "Peru", nationality: "Peruanisch" },
  { code: "AU", name: "Australien", nationality: "Australisch" },
  { code: "NZ", name: "Neuseeland", nationality: "Neuseeländisch" },
];

/**
 * Länder als Options für Select-Komponenten (Ländernamen)
 */
export const COUNTRY_OPTIONS = countries.map(c => ({
  code: c.code,
  name: c.name,
  value: c.code,
  label: c.name
}));

/**
 * Staatsangehörigkeiten als Options für Select-Komponenten (Adjektive)
 */
export const NATIONALITY_OPTIONS = countries.map(c => ({
  code: c.code,
  name: c.nationality,
  value: c.code,
  label: c.nationality
}));

/**
 * Findet den Ländercode anhand des Ländernamens
 * @param name - Name des Landes (z.B. "Deutschland")
 * @returns ISO-Code (z.B. "DE") oder leeren String
 */
export const getCountryCode = (name: string): string => {
  if (!name) return "";
  
  // Exakte Übereinstimmung (case-insensitive)
  const country = countries.find(
    c => c.name.toLowerCase() === name.toLowerCase() ||
         c.code.toLowerCase() === name.toLowerCase()
  );
  
  if (country) return country.code;
  
  // Partielle Übereinstimmung
  const partial = countries.find(
    c => c.name.toLowerCase().includes(name.toLowerCase()) ||
         name.toLowerCase().includes(c.name.toLowerCase())
  );
  
  return partial?.code || "";
};

/**
 * Findet den Ländernamen anhand des Codes
 * @param code - ISO-Code (z.B. "DE")
 * @returns Name des Landes (z.B. "Deutschland")
 */
export const getCountryName = (code: string): string => {
  if (!code) return "";
  const country = countries.find(c => c.code.toLowerCase() === code.toLowerCase());
  return country?.name || code;
};

/**
 * Findet die Staatsangehörigkeit (Adjektiv) anhand des Codes
 * @param code - ISO-Code (z.B. "DE")
 * @returns Staatsangehörigkeit als Adjektiv (z.B. "Deutsch")
 */
export const getNationalityName = (code: string): string => {
  if (!code) return "";
  const country = countries.find(c => c.code.toLowerCase() === code.toLowerCase());
  return country?.nationality || code;
};
