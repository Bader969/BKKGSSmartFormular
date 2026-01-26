/**
 * Liste der Länder mit ISO 3166-1 Alpha-2 Codes
 * Sortiert nach Häufigkeit (Deutschland zuerst, dann alphabetisch)
 */
export interface Country {
  code: string;
  name: string;
}

export const countries: Country[] = [
  { code: "DE", name: "Deutschland" },
  { code: "TR", name: "Türkei" },
  { code: "SY", name: "Syrien" },
  { code: "PL", name: "Polen" },
  { code: "RU", name: "Russland" },
  { code: "UA", name: "Ukraine" },
  { code: "RO", name: "Rumänien" },
  { code: "IT", name: "Italien" },
  { code: "GR", name: "Griechenland" },
  { code: "HR", name: "Kroatien" },
  { code: "RS", name: "Serbien" },
  { code: "BG", name: "Bulgarien" },
  { code: "HU", name: "Ungarn" },
  { code: "AT", name: "Österreich" },
  { code: "CH", name: "Schweiz" },
  { code: "NL", name: "Niederlande" },
  { code: "BE", name: "Belgien" },
  { code: "FR", name: "Frankreich" },
  { code: "ES", name: "Spanien" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Großbritannien" },
  { code: "IE", name: "Irland" },
  { code: "CZ", name: "Tschechien" },
  { code: "SK", name: "Slowakei" },
  { code: "SI", name: "Slowenien" },
  { code: "BA", name: "Bosnien und Herzegowina" },
  { code: "ME", name: "Montenegro" },
  { code: "MK", name: "Nordmazedonien" },
  { code: "AL", name: "Albanien" },
  { code: "XK", name: "Kosovo" },
  { code: "MD", name: "Moldawien" },
  { code: "BY", name: "Belarus" },
  { code: "LT", name: "Litauen" },
  { code: "LV", name: "Lettland" },
  { code: "EE", name: "Estland" },
  { code: "FI", name: "Finnland" },
  { code: "SE", name: "Schweden" },
  { code: "NO", name: "Norwegen" },
  { code: "DK", name: "Dänemark" },
  { code: "AF", name: "Afghanistan" },
  { code: "IQ", name: "Irak" },
  { code: "IR", name: "Iran" },
  { code: "LB", name: "Libanon" },
  { code: "JO", name: "Jordanien" },
  { code: "PS", name: "Palästina" },
  { code: "EG", name: "Ägypten" },
  { code: "MA", name: "Marokko" },
  { code: "TN", name: "Tunesien" },
  { code: "DZ", name: "Algerien" },
  { code: "LY", name: "Libyen" },
  { code: "ER", name: "Eritrea" },
  { code: "ET", name: "Äthiopien" },
  { code: "SO", name: "Somalia" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "CM", name: "Kamerun" },
  { code: "CD", name: "Kongo (Dem. Rep.)" },
  { code: "ZA", name: "Südafrika" },
  { code: "KE", name: "Kenia" },
  { code: "IN", name: "Indien" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesch" },
  { code: "LK", name: "Sri Lanka" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "Südkorea" },
  { code: "VN", name: "Vietnam" },
  { code: "TH", name: "Thailand" },
  { code: "PH", name: "Philippinen" },
  { code: "ID", name: "Indonesien" },
  { code: "MY", name: "Malaysia" },
  { code: "US", name: "USA" },
  { code: "CA", name: "Kanada" },
  { code: "MX", name: "Mexiko" },
  { code: "BR", name: "Brasilien" },
  { code: "AR", name: "Argentinien" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Kolumbien" },
  { code: "VE", name: "Venezuela" },
  { code: "PE", name: "Peru" },
  { code: "AU", name: "Australien" },
  { code: "NZ", name: "Neuseeland" },
];

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
