// Canonical list of the world's countries — the single source of truth for country codes,
// names, and continent assignments, reused by the World Map (Phase 9), World Compare, and
// World List views (Phase 10). The US-states equivalent is usStates.ts; this file follows
// the same shape deliberately, since country tracking and state tracking are parallel but
// fully independent features.
//
// Scope: the 193 UN member states plus the 2 UN observer states (Vatican City, Palestine)
// = 195 entries. No dependent territories, no partially-recognized states — see
// Documentation/Phase-8-World-Data-Layer.md.

/** The six inhabited continents. Antarctica is deliberately excluded — nobody's tracking visits there. */
export type Continent =
  "Africa" | "Asia" | "Europe" | "North America" | "Oceania" | "South America";

export const CONTINENTS: Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
];

export interface Country {
  code: string; // ISO 3166-1 alpha-2, e.g. "FR"
  alpha3: string; // ISO 3166-1 alpha-3, e.g. "FRA" — shown as the country's label on the world map
  numericCode: string; // ISO 3166-1 numeric, zero-padded to 3 chars, e.g. "250"
  name: string;
  continent: Continent;
}

// Ordered alphabetically by name, so any continent-filtered slice is already alphabetical
// and the World List view needs no re-sorting.
//
// Continent assignment is a convention, not something ISO 3166 defines. The transcontinental
// and otherwise arguable calls (Russia -> Europe, Turkey/Kazakhstan/Azerbaijan/Georgia/Armenia
// -> Asia, Cyprus -> Europe, Egypt -> Africa, Timor-Leste -> Asia, Caribbean -> North America)
// are fixed, documented decisions from Documentation/Phase-8-World-Data-Layer.md — don't
// "correct" them here without updating that doc.
export const COUNTRIES: Country[] = [
  { code: "AF", alpha3: "AFG", numericCode: "004", name: "Afghanistan", continent: "Asia" },
  { code: "AL", alpha3: "ALB", numericCode: "008", name: "Albania", continent: "Europe" },
  { code: "DZ", alpha3: "DZA", numericCode: "012", name: "Algeria", continent: "Africa" },
  { code: "AD", alpha3: "AND", numericCode: "020", name: "Andorra", continent: "Europe" },
  { code: "AO", alpha3: "AGO", numericCode: "024", name: "Angola", continent: "Africa" },
  { code: "AG", alpha3: "ATG", numericCode: "028", name: "Antigua and Barbuda", continent: "North America" },
  { code: "AR", alpha3: "ARG", numericCode: "032", name: "Argentina", continent: "South America" },
  { code: "AM", alpha3: "ARM", numericCode: "051", name: "Armenia", continent: "Asia" },
  { code: "AU", alpha3: "AUS", numericCode: "036", name: "Australia", continent: "Oceania" },
  { code: "AT", alpha3: "AUT", numericCode: "040", name: "Austria", continent: "Europe" },
  { code: "AZ", alpha3: "AZE", numericCode: "031", name: "Azerbaijan", continent: "Asia" },
  { code: "BS", alpha3: "BHS", numericCode: "044", name: "Bahamas", continent: "North America" },
  { code: "BH", alpha3: "BHR", numericCode: "048", name: "Bahrain", continent: "Asia" },
  { code: "BD", alpha3: "BGD", numericCode: "050", name: "Bangladesh", continent: "Asia" },
  { code: "BB", alpha3: "BRB", numericCode: "052", name: "Barbados", continent: "North America" },
  { code: "BY", alpha3: "BLR", numericCode: "112", name: "Belarus", continent: "Europe" },
  { code: "BE", alpha3: "BEL", numericCode: "056", name: "Belgium", continent: "Europe" },
  { code: "BZ", alpha3: "BLZ", numericCode: "084", name: "Belize", continent: "North America" },
  { code: "BJ", alpha3: "BEN", numericCode: "204", name: "Benin", continent: "Africa" },
  { code: "BT", alpha3: "BTN", numericCode: "064", name: "Bhutan", continent: "Asia" },
  { code: "BO", alpha3: "BOL", numericCode: "068", name: "Bolivia", continent: "South America" },
  { code: "BA", alpha3: "BIH", numericCode: "070", name: "Bosnia and Herzegovina", continent: "Europe" },
  { code: "BW", alpha3: "BWA", numericCode: "072", name: "Botswana", continent: "Africa" },
  { code: "BR", alpha3: "BRA", numericCode: "076", name: "Brazil", continent: "South America" },
  { code: "BN", alpha3: "BRN", numericCode: "096", name: "Brunei", continent: "Asia" },
  { code: "BG", alpha3: "BGR", numericCode: "100", name: "Bulgaria", continent: "Europe" },
  { code: "BF", alpha3: "BFA", numericCode: "854", name: "Burkina Faso", continent: "Africa" },
  { code: "BI", alpha3: "BDI", numericCode: "108", name: "Burundi", continent: "Africa" },
  { code: "CV", alpha3: "CPV", numericCode: "132", name: "Cabo Verde", continent: "Africa" },
  { code: "KH", alpha3: "KHM", numericCode: "116", name: "Cambodia", continent: "Asia" },
  { code: "CM", alpha3: "CMR", numericCode: "120", name: "Cameroon", continent: "Africa" },
  { code: "CA", alpha3: "CAN", numericCode: "124", name: "Canada", continent: "North America" },
  { code: "CF", alpha3: "CAF", numericCode: "140", name: "Central African Republic", continent: "Africa" },
  { code: "TD", alpha3: "TCD", numericCode: "148", name: "Chad", continent: "Africa" },
  { code: "CL", alpha3: "CHL", numericCode: "152", name: "Chile", continent: "South America" },
  { code: "CN", alpha3: "CHN", numericCode: "156", name: "China", continent: "Asia" },
  { code: "CO", alpha3: "COL", numericCode: "170", name: "Colombia", continent: "South America" },
  { code: "KM", alpha3: "COM", numericCode: "174", name: "Comoros", continent: "Africa" },
  { code: "CR", alpha3: "CRI", numericCode: "188", name: "Costa Rica", continent: "North America" },
  { code: "CI", alpha3: "CIV", numericCode: "384", name: "Côte d'Ivoire", continent: "Africa" },
  { code: "HR", alpha3: "HRV", numericCode: "191", name: "Croatia", continent: "Europe" },
  { code: "CU", alpha3: "CUB", numericCode: "192", name: "Cuba", continent: "North America" },
  { code: "CY", alpha3: "CYP", numericCode: "196", name: "Cyprus", continent: "Europe" },
  { code: "CZ", alpha3: "CZE", numericCode: "203", name: "Czechia", continent: "Europe" },
  {
    code: "CD",
    alpha3: "COD",
    numericCode: "180",
    name: "Democratic Republic of the Congo",
    continent: "Africa",
  },
  { code: "DK", alpha3: "DNK", numericCode: "208", name: "Denmark", continent: "Europe" },
  { code: "DJ", alpha3: "DJI", numericCode: "262", name: "Djibouti", continent: "Africa" },
  { code: "DM", alpha3: "DMA", numericCode: "212", name: "Dominica", continent: "North America" },
  { code: "DO", alpha3: "DOM", numericCode: "214", name: "Dominican Republic", continent: "North America" },
  { code: "EC", alpha3: "ECU", numericCode: "218", name: "Ecuador", continent: "South America" },
  { code: "EG", alpha3: "EGY", numericCode: "818", name: "Egypt", continent: "Africa" },
  { code: "SV", alpha3: "SLV", numericCode: "222", name: "El Salvador", continent: "North America" },
  { code: "GQ", alpha3: "GNQ", numericCode: "226", name: "Equatorial Guinea", continent: "Africa" },
  { code: "ER", alpha3: "ERI", numericCode: "232", name: "Eritrea", continent: "Africa" },
  { code: "EE", alpha3: "EST", numericCode: "233", name: "Estonia", continent: "Europe" },
  { code: "SZ", alpha3: "SWZ", numericCode: "748", name: "Eswatini", continent: "Africa" },
  { code: "ET", alpha3: "ETH", numericCode: "231", name: "Ethiopia", continent: "Africa" },
  { code: "FJ", alpha3: "FJI", numericCode: "242", name: "Fiji", continent: "Oceania" },
  { code: "FI", alpha3: "FIN", numericCode: "246", name: "Finland", continent: "Europe" },
  { code: "FR", alpha3: "FRA", numericCode: "250", name: "France", continent: "Europe" },
  { code: "GA", alpha3: "GAB", numericCode: "266", name: "Gabon", continent: "Africa" },
  { code: "GM", alpha3: "GMB", numericCode: "270", name: "Gambia", continent: "Africa" },
  { code: "GE", alpha3: "GEO", numericCode: "268", name: "Georgia", continent: "Asia" },
  { code: "DE", alpha3: "DEU", numericCode: "276", name: "Germany", continent: "Europe" },
  { code: "GH", alpha3: "GHA", numericCode: "288", name: "Ghana", continent: "Africa" },
  { code: "GR", alpha3: "GRC", numericCode: "300", name: "Greece", continent: "Europe" },
  { code: "GD", alpha3: "GRD", numericCode: "308", name: "Grenada", continent: "North America" },
  { code: "GT", alpha3: "GTM", numericCode: "320", name: "Guatemala", continent: "North America" },
  { code: "GN", alpha3: "GIN", numericCode: "324", name: "Guinea", continent: "Africa" },
  { code: "GW", alpha3: "GNB", numericCode: "624", name: "Guinea-Bissau", continent: "Africa" },
  { code: "GY", alpha3: "GUY", numericCode: "328", name: "Guyana", continent: "South America" },
  { code: "HT", alpha3: "HTI", numericCode: "332", name: "Haiti", continent: "North America" },
  { code: "HN", alpha3: "HND", numericCode: "340", name: "Honduras", continent: "North America" },
  { code: "HU", alpha3: "HUN", numericCode: "348", name: "Hungary", continent: "Europe" },
  { code: "IS", alpha3: "ISL", numericCode: "352", name: "Iceland", continent: "Europe" },
  { code: "IN", alpha3: "IND", numericCode: "356", name: "India", continent: "Asia" },
  { code: "ID", alpha3: "IDN", numericCode: "360", name: "Indonesia", continent: "Asia" },
  { code: "IR", alpha3: "IRN", numericCode: "364", name: "Iran", continent: "Asia" },
  { code: "IQ", alpha3: "IRQ", numericCode: "368", name: "Iraq", continent: "Asia" },
  { code: "IE", alpha3: "IRL", numericCode: "372", name: "Ireland", continent: "Europe" },
  { code: "IL", alpha3: "ISR", numericCode: "376", name: "Israel", continent: "Asia" },
  { code: "IT", alpha3: "ITA", numericCode: "380", name: "Italy", continent: "Europe" },
  { code: "JM", alpha3: "JAM", numericCode: "388", name: "Jamaica", continent: "North America" },
  { code: "JP", alpha3: "JPN", numericCode: "392", name: "Japan", continent: "Asia" },
  { code: "JO", alpha3: "JOR", numericCode: "400", name: "Jordan", continent: "Asia" },
  { code: "KZ", alpha3: "KAZ", numericCode: "398", name: "Kazakhstan", continent: "Asia" },
  { code: "KE", alpha3: "KEN", numericCode: "404", name: "Kenya", continent: "Africa" },
  { code: "KI", alpha3: "KIR", numericCode: "296", name: "Kiribati", continent: "Oceania" },
  { code: "KW", alpha3: "KWT", numericCode: "414", name: "Kuwait", continent: "Asia" },
  { code: "KG", alpha3: "KGZ", numericCode: "417", name: "Kyrgyzstan", continent: "Asia" },
  { code: "LA", alpha3: "LAO", numericCode: "418", name: "Laos", continent: "Asia" },
  { code: "LV", alpha3: "LVA", numericCode: "428", name: "Latvia", continent: "Europe" },
  { code: "LB", alpha3: "LBN", numericCode: "422", name: "Lebanon", continent: "Asia" },
  { code: "LS", alpha3: "LSO", numericCode: "426", name: "Lesotho", continent: "Africa" },
  { code: "LR", alpha3: "LBR", numericCode: "430", name: "Liberia", continent: "Africa" },
  { code: "LY", alpha3: "LBY", numericCode: "434", name: "Libya", continent: "Africa" },
  { code: "LI", alpha3: "LIE", numericCode: "438", name: "Liechtenstein", continent: "Europe" },
  { code: "LT", alpha3: "LTU", numericCode: "440", name: "Lithuania", continent: "Europe" },
  { code: "LU", alpha3: "LUX", numericCode: "442", name: "Luxembourg", continent: "Europe" },
  { code: "MG", alpha3: "MDG", numericCode: "450", name: "Madagascar", continent: "Africa" },
  { code: "MW", alpha3: "MWI", numericCode: "454", name: "Malawi", continent: "Africa" },
  { code: "MY", alpha3: "MYS", numericCode: "458", name: "Malaysia", continent: "Asia" },
  { code: "MV", alpha3: "MDV", numericCode: "462", name: "Maldives", continent: "Asia" },
  { code: "ML", alpha3: "MLI", numericCode: "466", name: "Mali", continent: "Africa" },
  { code: "MT", alpha3: "MLT", numericCode: "470", name: "Malta", continent: "Europe" },
  { code: "MH", alpha3: "MHL", numericCode: "584", name: "Marshall Islands", continent: "Oceania" },
  { code: "MR", alpha3: "MRT", numericCode: "478", name: "Mauritania", continent: "Africa" },
  { code: "MU", alpha3: "MUS", numericCode: "480", name: "Mauritius", continent: "Africa" },
  { code: "MX", alpha3: "MEX", numericCode: "484", name: "Mexico", continent: "North America" },
  { code: "FM", alpha3: "FSM", numericCode: "583", name: "Micronesia", continent: "Oceania" },
  { code: "MD", alpha3: "MDA", numericCode: "498", name: "Moldova", continent: "Europe" },
  { code: "MC", alpha3: "MCO", numericCode: "492", name: "Monaco", continent: "Europe" },
  { code: "MN", alpha3: "MNG", numericCode: "496", name: "Mongolia", continent: "Asia" },
  { code: "ME", alpha3: "MNE", numericCode: "499", name: "Montenegro", continent: "Europe" },
  { code: "MA", alpha3: "MAR", numericCode: "504", name: "Morocco", continent: "Africa" },
  { code: "MZ", alpha3: "MOZ", numericCode: "508", name: "Mozambique", continent: "Africa" },
  { code: "MM", alpha3: "MMR", numericCode: "104", name: "Myanmar", continent: "Asia" },
  { code: "NA", alpha3: "NAM", numericCode: "516", name: "Namibia", continent: "Africa" },
  { code: "NR", alpha3: "NRU", numericCode: "520", name: "Nauru", continent: "Oceania" },
  { code: "NP", alpha3: "NPL", numericCode: "524", name: "Nepal", continent: "Asia" },
  { code: "NL", alpha3: "NLD", numericCode: "528", name: "Netherlands", continent: "Europe" },
  { code: "NZ", alpha3: "NZL", numericCode: "554", name: "New Zealand", continent: "Oceania" },
  { code: "NI", alpha3: "NIC", numericCode: "558", name: "Nicaragua", continent: "North America" },
  { code: "NE", alpha3: "NER", numericCode: "562", name: "Niger", continent: "Africa" },
  { code: "NG", alpha3: "NGA", numericCode: "566", name: "Nigeria", continent: "Africa" },
  { code: "KP", alpha3: "PRK", numericCode: "408", name: "North Korea", continent: "Asia" },
  { code: "MK", alpha3: "MKD", numericCode: "807", name: "North Macedonia", continent: "Europe" },
  { code: "NO", alpha3: "NOR", numericCode: "578", name: "Norway", continent: "Europe" },
  { code: "OM", alpha3: "OMN", numericCode: "512", name: "Oman", continent: "Asia" },
  { code: "PK", alpha3: "PAK", numericCode: "586", name: "Pakistan", continent: "Asia" },
  { code: "PW", alpha3: "PLW", numericCode: "585", name: "Palau", continent: "Oceania" },
  { code: "PS", alpha3: "PSE", numericCode: "275", name: "Palestine", continent: "Asia" },
  { code: "PA", alpha3: "PAN", numericCode: "591", name: "Panama", continent: "North America" },
  { code: "PG", alpha3: "PNG", numericCode: "598", name: "Papua New Guinea", continent: "Oceania" },
  { code: "PY", alpha3: "PRY", numericCode: "600", name: "Paraguay", continent: "South America" },
  { code: "PE", alpha3: "PER", numericCode: "604", name: "Peru", continent: "South America" },
  { code: "PH", alpha3: "PHL", numericCode: "608", name: "Philippines", continent: "Asia" },
  { code: "PL", alpha3: "POL", numericCode: "616", name: "Poland", continent: "Europe" },
  { code: "PT", alpha3: "PRT", numericCode: "620", name: "Portugal", continent: "Europe" },
  { code: "QA", alpha3: "QAT", numericCode: "634", name: "Qatar", continent: "Asia" },
  { code: "CG", alpha3: "COG", numericCode: "178", name: "Republic of the Congo", continent: "Africa" },
  { code: "RO", alpha3: "ROU", numericCode: "642", name: "Romania", continent: "Europe" },
  { code: "RU", alpha3: "RUS", numericCode: "643", name: "Russia", continent: "Europe" },
  { code: "RW", alpha3: "RWA", numericCode: "646", name: "Rwanda", continent: "Africa" },
  { code: "KN", alpha3: "KNA", numericCode: "659", name: "Saint Kitts and Nevis", continent: "North America" },
  { code: "LC", alpha3: "LCA", numericCode: "662", name: "Saint Lucia", continent: "North America" },
  {
    code: "VC",
    alpha3: "VCT",
    numericCode: "670",
    name: "Saint Vincent and the Grenadines",
    continent: "North America",
  },
  { code: "WS", alpha3: "WSM", numericCode: "882", name: "Samoa", continent: "Oceania" },
  { code: "SM", alpha3: "SMR", numericCode: "674", name: "San Marino", continent: "Europe" },
  { code: "ST", alpha3: "STP", numericCode: "678", name: "São Tomé and Príncipe", continent: "Africa" },
  { code: "SA", alpha3: "SAU", numericCode: "682", name: "Saudi Arabia", continent: "Asia" },
  { code: "SN", alpha3: "SEN", numericCode: "686", name: "Senegal", continent: "Africa" },
  { code: "RS", alpha3: "SRB", numericCode: "688", name: "Serbia", continent: "Europe" },
  { code: "SC", alpha3: "SYC", numericCode: "690", name: "Seychelles", continent: "Africa" },
  { code: "SL", alpha3: "SLE", numericCode: "694", name: "Sierra Leone", continent: "Africa" },
  { code: "SG", alpha3: "SGP", numericCode: "702", name: "Singapore", continent: "Asia" },
  { code: "SK", alpha3: "SVK", numericCode: "703", name: "Slovakia", continent: "Europe" },
  { code: "SI", alpha3: "SVN", numericCode: "705", name: "Slovenia", continent: "Europe" },
  { code: "SB", alpha3: "SLB", numericCode: "090", name: "Solomon Islands", continent: "Oceania" },
  { code: "SO", alpha3: "SOM", numericCode: "706", name: "Somalia", continent: "Africa" },
  { code: "ZA", alpha3: "ZAF", numericCode: "710", name: "South Africa", continent: "Africa" },
  { code: "KR", alpha3: "KOR", numericCode: "410", name: "South Korea", continent: "Asia" },
  { code: "SS", alpha3: "SSD", numericCode: "728", name: "South Sudan", continent: "Africa" },
  { code: "ES", alpha3: "ESP", numericCode: "724", name: "Spain", continent: "Europe" },
  { code: "LK", alpha3: "LKA", numericCode: "144", name: "Sri Lanka", continent: "Asia" },
  { code: "SD", alpha3: "SDN", numericCode: "729", name: "Sudan", continent: "Africa" },
  { code: "SR", alpha3: "SUR", numericCode: "740", name: "Suriname", continent: "South America" },
  { code: "SE", alpha3: "SWE", numericCode: "752", name: "Sweden", continent: "Europe" },
  { code: "CH", alpha3: "CHE", numericCode: "756", name: "Switzerland", continent: "Europe" },
  { code: "SY", alpha3: "SYR", numericCode: "760", name: "Syria", continent: "Asia" },
  { code: "TJ", alpha3: "TJK", numericCode: "762", name: "Tajikistan", continent: "Asia" },
  { code: "TZ", alpha3: "TZA", numericCode: "834", name: "Tanzania", continent: "Africa" },
  { code: "TH", alpha3: "THA", numericCode: "764", name: "Thailand", continent: "Asia" },
  { code: "TL", alpha3: "TLS", numericCode: "626", name: "Timor-Leste", continent: "Asia" },
  { code: "TG", alpha3: "TGO", numericCode: "768", name: "Togo", continent: "Africa" },
  { code: "TO", alpha3: "TON", numericCode: "776", name: "Tonga", continent: "Oceania" },
  { code: "TT", alpha3: "TTO", numericCode: "780", name: "Trinidad and Tobago", continent: "North America" },
  { code: "TN", alpha3: "TUN", numericCode: "788", name: "Tunisia", continent: "Africa" },
  { code: "TR", alpha3: "TUR", numericCode: "792", name: "Turkey", continent: "Asia" },
  { code: "TM", alpha3: "TKM", numericCode: "795", name: "Turkmenistan", continent: "Asia" },
  { code: "TV", alpha3: "TUV", numericCode: "798", name: "Tuvalu", continent: "Oceania" },
  { code: "UG", alpha3: "UGA", numericCode: "800", name: "Uganda", continent: "Africa" },
  { code: "UA", alpha3: "UKR", numericCode: "804", name: "Ukraine", continent: "Europe" },
  { code: "AE", alpha3: "ARE", numericCode: "784", name: "United Arab Emirates", continent: "Asia" },
  { code: "GB", alpha3: "GBR", numericCode: "826", name: "United Kingdom", continent: "Europe" },
  { code: "US", alpha3: "USA", numericCode: "840", name: "United States", continent: "North America" },
  { code: "UY", alpha3: "URY", numericCode: "858", name: "Uruguay", continent: "South America" },
  { code: "UZ", alpha3: "UZB", numericCode: "860", name: "Uzbekistan", continent: "Asia" },
  { code: "VU", alpha3: "VUT", numericCode: "548", name: "Vanuatu", continent: "Oceania" },
  { code: "VA", alpha3: "VAT", numericCode: "336", name: "Vatican City", continent: "Europe" },
  { code: "VE", alpha3: "VEN", numericCode: "862", name: "Venezuela", continent: "South America" },
  { code: "VN", alpha3: "VNM", numericCode: "704", name: "Vietnam", continent: "Asia" },
  { code: "YE", alpha3: "YEM", numericCode: "887", name: "Yemen", continent: "Asia" },
  { code: "ZM", alpha3: "ZMB", numericCode: "894", name: "Zambia", continent: "Africa" },
  { code: "ZW", alpha3: "ZWE", numericCode: "716", name: "Zimbabwe", continent: "Africa" },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

// ISO 3166-1 numeric code -> alpha-2 code. World TopoJSON datasets (e.g. world-atlas)
// identify countries by numeric id, not alpha-2, so this bridges the two — the country-level
// equivalent of usStates.ts's FIPS_TO_USPS. Derived from COUNTRIES rather than written out
// separately so the two can never drift apart. A numeric id with no entry here (Kosovo,
// Taiwan, Greenland, dependent territories) is intentionally untracked.
export const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.numericCode, c.code]),
);

/**
 * Returns every country on a given continent.
 * @param continent - the continent to filter by.
 * @returns that continent's countries, alphabetical by name (COUNTRIES' own ordering).
 */
export function countriesByContinent(continent: Continent): Country[] {
  return COUNTRIES.filter((c) => c.continent === continent);
}
