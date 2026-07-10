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
  // --- Weitere Länder (alphabetisch, vollständige ISO 3166-1 Abdeckung) ---
  { code: "AD", name: "Andorra", nationality: "Andorranisch" },
  { code: "AE", name: "Vereinigte Arabische Emirate", nationality: "Emiratisch" },
  { code: "AG", name: "Antigua und Barbuda", nationality: "Antiguanisch" },
  { code: "AI", name: "Anguilla", nationality: "Anguillanisch" },
  { code: "AM", name: "Armenien", nationality: "Armenisch" },
  { code: "AO", name: "Angola", nationality: "Angolanisch" },
  { code: "AQ", name: "Antarktis", nationality: "-" },
  { code: "AS", name: "Amerikanisch-Samoa", nationality: "Amerikanisch-Samoanisch" },
  { code: "AW", name: "Aruba", nationality: "Arubanisch" },
  { code: "AX", name: "Ålandinseln", nationality: "Ålandisch" },
  { code: "AZ", name: "Aserbaidschan", nationality: "Aserbaidschanisch" },
  { code: "BB", name: "Barbados", nationality: "Barbadisch" },
  { code: "BF", name: "Burkina Faso", nationality: "Burkinisch" },
  { code: "BH", name: "Bahrain", nationality: "Bahrainisch" },
  { code: "BI", name: "Burundi", nationality: "Burundisch" },
  { code: "BJ", name: "Benin", nationality: "Beninisch" },
  { code: "BL", name: "Saint-Barthélemy", nationality: "Barthélemyisch" },
  { code: "BM", name: "Bermuda", nationality: "Bermudisch" },
  { code: "BN", name: "Brunei", nationality: "Bruneiisch" },
  { code: "BO", name: "Bolivien", nationality: "Bolivianisch" },
  { code: "BQ", name: "Bonaire, Sint Eustatius und Saba", nationality: "Niederländisch-Karibisch" },
  { code: "BS", name: "Bahamas", nationality: "Bahamaisch" },
  { code: "BT", name: "Bhutan", nationality: "Bhutanisch" },
  { code: "BV", name: "Bouvetinsel", nationality: "-" },
  { code: "BW", name: "Botsuana", nationality: "Botsuanisch" },
  { code: "BZ", name: "Belize", nationality: "Belizisch" },
  { code: "CC", name: "Kokosinseln", nationality: "Kokosinsulanisch" },
  { code: "CF", name: "Zentralafrikanische Republik", nationality: "Zentralafrikanisch" },
  { code: "CG", name: "Kongo (Republik)", nationality: "Kongolesisch" },
  { code: "CI", name: "Elfenbeinküste", nationality: "Ivorisch" },
  { code: "CK", name: "Cookinseln", nationality: "Cookinsulanisch" },
  { code: "CR", name: "Costa Rica", nationality: "Costa-Ricanisch" },
  { code: "CU", name: "Kuba", nationality: "Kubanisch" },
  { code: "CV", name: "Kap Verde", nationality: "Kapverdisch" },
  { code: "CW", name: "Curaçao", nationality: "Curaçaoisch" },
  { code: "CX", name: "Weihnachtsinsel", nationality: "-" },
  { code: "CY", name: "Zypern", nationality: "Zyprisch" },
  { code: "DJ", name: "Dschibuti", nationality: "Dschibutisch" },
  { code: "DM", name: "Dominica", nationality: "Dominicanisch" },
  { code: "DO", name: "Dominikanische Republik", nationality: "Dominikanisch" },
  { code: "EC", name: "Ecuador", nationality: "Ecuadorianisch" },
  { code: "EH", name: "Westsahara", nationality: "Sahrauisch" },
  { code: "FJ", name: "Fidschi", nationality: "Fidschianisch" },
  { code: "FK", name: "Falklandinseln", nationality: "Falkländisch" },
  { code: "FM", name: "Mikronesien", nationality: "Mikronesisch" },
  { code: "FO", name: "Färöer", nationality: "Färöisch" },
  { code: "GA", name: "Gabun", nationality: "Gabunisch" },
  { code: "GD", name: "Grenada", nationality: "Grenadisch" },
  { code: "GE", name: "Georgien", nationality: "Georgisch" },
  { code: "GF", name: "Französisch-Guayana", nationality: "Französisch-Guayanisch" },
  { code: "GG", name: "Guernsey", nationality: "Guernseyisch" },
  { code: "GI", name: "Gibraltar", nationality: "Gibraltarisch" },
  { code: "GL", name: "Grönland", nationality: "Grönländisch" },
  { code: "GM", name: "Gambia", nationality: "Gambisch" },
  { code: "GN", name: "Guinea", nationality: "Guineisch" },
  { code: "GP", name: "Guadeloupe", nationality: "Guadeloupisch" },
  { code: "GQ", name: "Äquatorialguinea", nationality: "Äquatorialguineisch" },
  { code: "GS", name: "Südgeorgien und die Südlichen Sandwichinseln", nationality: "-" },
  { code: "GT", name: "Guatemala", nationality: "Guatemaltekisch" },
  { code: "GU", name: "Guam", nationality: "Guamisch" },
  { code: "GW", name: "Guinea-Bissau", nationality: "Guinea-Bissauisch" },
  { code: "GY", name: "Guyana", nationality: "Guyanisch" },
  { code: "HK", name: "Hongkong", nationality: "Hongkong-Chinesisch" },
  { code: "HM", name: "Heard und McDonaldinseln", nationality: "-" },
  { code: "HN", name: "Honduras", nationality: "Honduranisch" },
  { code: "HT", name: "Haiti", nationality: "Haitianisch" },
  { code: "IL", name: "Israel", nationality: "Israelisch" },
  { code: "IM", name: "Isle of Man", nationality: "Manx" },
  { code: "IO", name: "Britisches Territorium im Indischen Ozean", nationality: "-" },
  { code: "IS", name: "Island", nationality: "Isländisch" },
  { code: "JE", name: "Jersey", nationality: "Jerseyisch" },
  { code: "JM", name: "Jamaika", nationality: "Jamaikanisch" },
  { code: "KG", name: "Kirgisistan", nationality: "Kirgisisch" },
  { code: "KH", name: "Kambodscha", nationality: "Kambodschanisch" },
  { code: "KI", name: "Kiribati", nationality: "Kiribatisch" },
  { code: "KM", name: "Komoren", nationality: "Komorisch" },
  { code: "KN", name: "St. Kitts und Nevis", nationality: "Kittitisch" },
  { code: "KP", name: "Nordkorea", nationality: "Nordkoreanisch" },
  { code: "KW", name: "Kuwait", nationality: "Kuwaitisch" },
  { code: "KY", name: "Kaimaninseln", nationality: "Kaimanisch" },
  { code: "KZ", name: "Kasachstan", nationality: "Kasachisch" },
  { code: "LA", name: "Laos", nationality: "Laotisch" },
  { code: "LC", name: "St. Lucia", nationality: "Lucianisch" },
  { code: "LI", name: "Liechtenstein", nationality: "Liechtensteinisch" },
  { code: "LR", name: "Liberia", nationality: "Liberianisch" },
  { code: "LS", name: "Lesotho", nationality: "Lesothisch" },
  { code: "LU", name: "Luxemburg", nationality: "Luxemburgisch" },
  { code: "MC", name: "Monaco", nationality: "Monegassisch" },
  { code: "MF", name: "Saint-Martin (franz. Teil)", nationality: "Saint-Martinisch" },
  { code: "MG", name: "Madagaskar", nationality: "Madagassisch" },
  { code: "MH", name: "Marshallinseln", nationality: "Marshallisch" },
  { code: "ML", name: "Mali", nationality: "Malisch" },
  { code: "MM", name: "Myanmar", nationality: "Myanmarisch" },
  { code: "MN", name: "Mongolei", nationality: "Mongolisch" },
  { code: "MO", name: "Macau", nationality: "Macauisch" },
  { code: "MP", name: "Nördliche Marianen", nationality: "Marianisch" },
  { code: "MQ", name: "Martinique", nationality: "Martinikanisch" },
  { code: "MR", name: "Mauretanien", nationality: "Mauretanisch" },
  { code: "MS", name: "Montserrat", nationality: "Montserratisch" },
  { code: "MT", name: "Malta", nationality: "Maltesisch" },
  { code: "MU", name: "Mauritius", nationality: "Mauritisch" },
  { code: "MV", name: "Malediven", nationality: "Maledivisch" },
  { code: "MW", name: "Malawi", nationality: "Malawisch" },
  { code: "MZ", name: "Mosambik", nationality: "Mosambikanisch" },
  { code: "NA", name: "Namibia", nationality: "Namibisch" },
  { code: "NC", name: "Neukaledonien", nationality: "Neukaledonisch" },
  { code: "NE", name: "Niger", nationality: "Nigrisch" },
  { code: "NF", name: "Norfolkinsel", nationality: "Norfolkisch" },
  { code: "NI", name: "Nicaragua", nationality: "Nicaraguanisch" },
  { code: "NP", name: "Nepal", nationality: "Nepalesisch" },
  { code: "NR", name: "Nauru", nationality: "Nauruisch" },
  { code: "NU", name: "Niue", nationality: "Niueisch" },
  { code: "OM", name: "Oman", nationality: "Omanisch" },
  { code: "PA", name: "Panama", nationality: "Panamaisch" },
  { code: "PF", name: "Französisch-Polynesien", nationality: "Französisch-Polynesisch" },
  { code: "PG", name: "Papua-Neuguinea", nationality: "Papua-Neuguineisch" },
  { code: "PM", name: "Saint-Pierre und Miquelon", nationality: "Saint-Pierrisch" },
  { code: "PN", name: "Pitcairninseln", nationality: "Pitcairnisch" },
  { code: "PR", name: "Puerto Rico", nationality: "Puerto-Ricanisch" },
  { code: "PW", name: "Palau", nationality: "Palauisch" },
  { code: "PY", name: "Paraguay", nationality: "Paraguayisch" },
  { code: "QA", name: "Katar", nationality: "Katarisch" },
  { code: "RE", name: "Réunion", nationality: "Réunionesisch" },
  { code: "RW", name: "Ruanda", nationality: "Ruandisch" },
  { code: "SA", name: "Saudi-Arabien", nationality: "Saudi-Arabisch" },
  { code: "SB", name: "Salomonen", nationality: "Salomonisch" },
  { code: "SC", name: "Seychellen", nationality: "Seychellisch" },
  { code: "SD", name: "Sudan", nationality: "Sudanesisch" },
  { code: "SG", name: "Singapur", nationality: "Singapurisch" },
  { code: "SH", name: "St. Helena", nationality: "St.-Helenisch" },
  { code: "SJ", name: "Svalbard und Jan Mayen", nationality: "-" },
  { code: "SL", name: "Sierra Leone", nationality: "Sierra-Leonisch" },
  { code: "SM", name: "San Marino", nationality: "San-Marinesisch" },
  { code: "SN", name: "Senegal", nationality: "Senegalesisch" },
  { code: "SR", name: "Suriname", nationality: "Surinamisch" },
  { code: "SS", name: "Südsudan", nationality: "Südsudanesisch" },
  { code: "ST", name: "São Tomé und Príncipe", nationality: "São-Toméisch" },
  { code: "SV", name: "El Salvador", nationality: "Salvadorianisch" },
  { code: "SX", name: "Sint Maarten (niederl. Teil)", nationality: "Sint-Maartenisch" },
  { code: "SZ", name: "Eswatini", nationality: "Swasiländisch" },
  { code: "TC", name: "Turks- und Caicosinseln", nationality: "Turks- und Caicosianisch" },
  { code: "TD", name: "Tschad", nationality: "Tschadisch" },
  { code: "TF", name: "Französische Süd- und Antarktisgebiete", nationality: "-" },
  { code: "TG", name: "Togo", nationality: "Togoisch" },
  { code: "TJ", name: "Tadschikistan", nationality: "Tadschikisch" },
  { code: "TK", name: "Tokelau", nationality: "Tokelauisch" },
  { code: "TL", name: "Timor-Leste", nationality: "Timoresisch" },
  { code: "TM", name: "Turkmenistan", nationality: "Turkmenisch" },
  { code: "TO", name: "Tonga", nationality: "Tongaisch" },
  { code: "TT", name: "Trinidad und Tobago", nationality: "Trinidadisch" },
  { code: "TV", name: "Tuvalu", nationality: "Tuvaluisch" },
  { code: "TW", name: "Taiwan", nationality: "Taiwanisch" },
  { code: "TZ", name: "Tansania", nationality: "Tansanisch" },
  { code: "UG", name: "Uganda", nationality: "Ugandisch" },
  { code: "UM", name: "Amerikanische Überseeinseln", nationality: "-" },
  { code: "UY", name: "Uruguay", nationality: "Uruguayisch" },
  { code: "UZ", name: "Usbekistan", nationality: "Usbekisch" },
  { code: "VA", name: "Vatikanstadt", nationality: "Vatikanisch" },
  { code: "VC", name: "St. Vincent und die Grenadinen", nationality: "Vincentisch" },
  { code: "VG", name: "Britische Jungferninseln", nationality: "Britisch-Jungferninsulanisch" },
  { code: "VI", name: "Amerikanische Jungferninseln", nationality: "Amerikanisch-Jungferninsulanisch" },
  { code: "VU", name: "Vanuatu", nationality: "Vanuatuisch" },
  { code: "WF", name: "Wallis und Futuna", nationality: "Wallisianisch" },
  { code: "WS", name: "Samoa", nationality: "Samoanisch" },
  { code: "YE", name: "Jemen", nationality: "Jemenitisch" },
  { code: "YT", name: "Mayotte", nationality: "Mahorisch" },
  { code: "ZM", name: "Sambia", nationality: "Sambisch" },
  { code: "ZW", name: "Simbabwe", nationality: "Simbabwisch" },
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
