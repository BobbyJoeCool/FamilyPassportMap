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
  { code: "AF", numericCode: "004", name: "Afghanistan", continent: "Asia" },
  { code: "AL", numericCode: "008", name: "Albania", continent: "Europe" },
  { code: "DZ", numericCode: "012", name: "Algeria", continent: "Africa" },
  { code: "AD", numericCode: "020", name: "Andorra", continent: "Europe" },
  { code: "AO", numericCode: "024", name: "Angola", continent: "Africa" },
  { code: "AG", numericCode: "028", name: "Antigua and Barbuda", continent: "North America" },
  { code: "AR", numericCode: "032", name: "Argentina", continent: "South America" },
  { code: "AM", numericCode: "051", name: "Armenia", continent: "Asia" },
  { code: "AU", numericCode: "036", name: "Australia", continent: "Oceania" },
  { code: "AT", numericCode: "040", name: "Austria", continent: "Europe" },
  { code: "AZ", numericCode: "031", name: "Azerbaijan", continent: "Asia" },
  { code: "BS", numericCode: "044", name: "Bahamas", continent: "North America" },
  { code: "BH", numericCode: "048", name: "Bahrain", continent: "Asia" },
  { code: "BD", numericCode: "050", name: "Bangladesh", continent: "Asia" },
  { code: "BB", numericCode: "052", name: "Barbados", continent: "North America" },
  { code: "BY", numericCode: "112", name: "Belarus", continent: "Europe" },
  { code: "BE", numericCode: "056", name: "Belgium", continent: "Europe" },
  { code: "BZ", numericCode: "084", name: "Belize", continent: "North America" },
  { code: "BJ", numericCode: "204", name: "Benin", continent: "Africa" },
  { code: "BT", numericCode: "064", name: "Bhutan", continent: "Asia" },
  { code: "BO", numericCode: "068", name: "Bolivia", continent: "South America" },
  { code: "BA", numericCode: "070", name: "Bosnia and Herzegovina", continent: "Europe" },
  { code: "BW", numericCode: "072", name: "Botswana", continent: "Africa" },
  { code: "BR", numericCode: "076", name: "Brazil", continent: "South America" },
  { code: "BN", numericCode: "096", name: "Brunei", continent: "Asia" },
  { code: "BG", numericCode: "100", name: "Bulgaria", continent: "Europe" },
  { code: "BF", numericCode: "854", name: "Burkina Faso", continent: "Africa" },
  { code: "BI", numericCode: "108", name: "Burundi", continent: "Africa" },
  { code: "CV", numericCode: "132", name: "Cabo Verde", continent: "Africa" },
  { code: "KH", numericCode: "116", name: "Cambodia", continent: "Asia" },
  { code: "CM", numericCode: "120", name: "Cameroon", continent: "Africa" },
  { code: "CA", numericCode: "124", name: "Canada", continent: "North America" },
  { code: "CF", numericCode: "140", name: "Central African Republic", continent: "Africa" },
  { code: "TD", numericCode: "148", name: "Chad", continent: "Africa" },
  { code: "CL", numericCode: "152", name: "Chile", continent: "South America" },
  { code: "CN", numericCode: "156", name: "China", continent: "Asia" },
  { code: "CO", numericCode: "170", name: "Colombia", continent: "South America" },
  { code: "KM", numericCode: "174", name: "Comoros", continent: "Africa" },
  { code: "CR", numericCode: "188", name: "Costa Rica", continent: "North America" },
  { code: "CI", numericCode: "384", name: "Côte d'Ivoire", continent: "Africa" },
  { code: "HR", numericCode: "191", name: "Croatia", continent: "Europe" },
  { code: "CU", numericCode: "192", name: "Cuba", continent: "North America" },
  { code: "CY", numericCode: "196", name: "Cyprus", continent: "Europe" },
  { code: "CZ", numericCode: "203", name: "Czechia", continent: "Europe" },
  {
    code: "CD",
    numericCode: "180",
    name: "Democratic Republic of the Congo",
    continent: "Africa",
  },
  { code: "DK", numericCode: "208", name: "Denmark", continent: "Europe" },
  { code: "DJ", numericCode: "262", name: "Djibouti", continent: "Africa" },
  { code: "DM", numericCode: "212", name: "Dominica", continent: "North America" },
  { code: "DO", numericCode: "214", name: "Dominican Republic", continent: "North America" },
  { code: "EC", numericCode: "218", name: "Ecuador", continent: "South America" },
  { code: "EG", numericCode: "818", name: "Egypt", continent: "Africa" },
  { code: "SV", numericCode: "222", name: "El Salvador", continent: "North America" },
  { code: "GQ", numericCode: "226", name: "Equatorial Guinea", continent: "Africa" },
  { code: "ER", numericCode: "232", name: "Eritrea", continent: "Africa" },
  { code: "EE", numericCode: "233", name: "Estonia", continent: "Europe" },
  { code: "SZ", numericCode: "748", name: "Eswatini", continent: "Africa" },
  { code: "ET", numericCode: "231", name: "Ethiopia", continent: "Africa" },
  { code: "FJ", numericCode: "242", name: "Fiji", continent: "Oceania" },
  { code: "FI", numericCode: "246", name: "Finland", continent: "Europe" },
  { code: "FR", numericCode: "250", name: "France", continent: "Europe" },
  { code: "GA", numericCode: "266", name: "Gabon", continent: "Africa" },
  { code: "GM", numericCode: "270", name: "Gambia", continent: "Africa" },
  { code: "GE", numericCode: "268", name: "Georgia", continent: "Asia" },
  { code: "DE", numericCode: "276", name: "Germany", continent: "Europe" },
  { code: "GH", numericCode: "288", name: "Ghana", continent: "Africa" },
  { code: "GR", numericCode: "300", name: "Greece", continent: "Europe" },
  { code: "GD", numericCode: "308", name: "Grenada", continent: "North America" },
  { code: "GT", numericCode: "320", name: "Guatemala", continent: "North America" },
  { code: "GN", numericCode: "324", name: "Guinea", continent: "Africa" },
  { code: "GW", numericCode: "624", name: "Guinea-Bissau", continent: "Africa" },
  { code: "GY", numericCode: "328", name: "Guyana", continent: "South America" },
  { code: "HT", numericCode: "332", name: "Haiti", continent: "North America" },
  { code: "HN", numericCode: "340", name: "Honduras", continent: "North America" },
  { code: "HU", numericCode: "348", name: "Hungary", continent: "Europe" },
  { code: "IS", numericCode: "352", name: "Iceland", continent: "Europe" },
  { code: "IN", numericCode: "356", name: "India", continent: "Asia" },
  { code: "ID", numericCode: "360", name: "Indonesia", continent: "Asia" },
  { code: "IR", numericCode: "364", name: "Iran", continent: "Asia" },
  { code: "IQ", numericCode: "368", name: "Iraq", continent: "Asia" },
  { code: "IE", numericCode: "372", name: "Ireland", continent: "Europe" },
  { code: "IL", numericCode: "376", name: "Israel", continent: "Asia" },
  { code: "IT", numericCode: "380", name: "Italy", continent: "Europe" },
  { code: "JM", numericCode: "388", name: "Jamaica", continent: "North America" },
  { code: "JP", numericCode: "392", name: "Japan", continent: "Asia" },
  { code: "JO", numericCode: "400", name: "Jordan", continent: "Asia" },
  { code: "KZ", numericCode: "398", name: "Kazakhstan", continent: "Asia" },
  { code: "KE", numericCode: "404", name: "Kenya", continent: "Africa" },
  { code: "KI", numericCode: "296", name: "Kiribati", continent: "Oceania" },
  { code: "KW", numericCode: "414", name: "Kuwait", continent: "Asia" },
  { code: "KG", numericCode: "417", name: "Kyrgyzstan", continent: "Asia" },
  { code: "LA", numericCode: "418", name: "Laos", continent: "Asia" },
  { code: "LV", numericCode: "428", name: "Latvia", continent: "Europe" },
  { code: "LB", numericCode: "422", name: "Lebanon", continent: "Asia" },
  { code: "LS", numericCode: "426", name: "Lesotho", continent: "Africa" },
  { code: "LR", numericCode: "430", name: "Liberia", continent: "Africa" },
  { code: "LY", numericCode: "434", name: "Libya", continent: "Africa" },
  { code: "LI", numericCode: "438", name: "Liechtenstein", continent: "Europe" },
  { code: "LT", numericCode: "440", name: "Lithuania", continent: "Europe" },
  { code: "LU", numericCode: "442", name: "Luxembourg", continent: "Europe" },
  { code: "MG", numericCode: "450", name: "Madagascar", continent: "Africa" },
  { code: "MW", numericCode: "454", name: "Malawi", continent: "Africa" },
  { code: "MY", numericCode: "458", name: "Malaysia", continent: "Asia" },
  { code: "MV", numericCode: "462", name: "Maldives", continent: "Asia" },
  { code: "ML", numericCode: "466", name: "Mali", continent: "Africa" },
  { code: "MT", numericCode: "470", name: "Malta", continent: "Europe" },
  { code: "MH", numericCode: "584", name: "Marshall Islands", continent: "Oceania" },
  { code: "MR", numericCode: "478", name: "Mauritania", continent: "Africa" },
  { code: "MU", numericCode: "480", name: "Mauritius", continent: "Africa" },
  { code: "MX", numericCode: "484", name: "Mexico", continent: "North America" },
  { code: "FM", numericCode: "583", name: "Micronesia", continent: "Oceania" },
  { code: "MD", numericCode: "498", name: "Moldova", continent: "Europe" },
  { code: "MC", numericCode: "492", name: "Monaco", continent: "Europe" },
  { code: "MN", numericCode: "496", name: "Mongolia", continent: "Asia" },
  { code: "ME", numericCode: "499", name: "Montenegro", continent: "Europe" },
  { code: "MA", numericCode: "504", name: "Morocco", continent: "Africa" },
  { code: "MZ", numericCode: "508", name: "Mozambique", continent: "Africa" },
  { code: "MM", numericCode: "104", name: "Myanmar", continent: "Asia" },
  { code: "NA", numericCode: "516", name: "Namibia", continent: "Africa" },
  { code: "NR", numericCode: "520", name: "Nauru", continent: "Oceania" },
  { code: "NP", numericCode: "524", name: "Nepal", continent: "Asia" },
  { code: "NL", numericCode: "528", name: "Netherlands", continent: "Europe" },
  { code: "NZ", numericCode: "554", name: "New Zealand", continent: "Oceania" },
  { code: "NI", numericCode: "558", name: "Nicaragua", continent: "North America" },
  { code: "NE", numericCode: "562", name: "Niger", continent: "Africa" },
  { code: "NG", numericCode: "566", name: "Nigeria", continent: "Africa" },
  { code: "KP", numericCode: "408", name: "North Korea", continent: "Asia" },
  { code: "MK", numericCode: "807", name: "North Macedonia", continent: "Europe" },
  { code: "NO", numericCode: "578", name: "Norway", continent: "Europe" },
  { code: "OM", numericCode: "512", name: "Oman", continent: "Asia" },
  { code: "PK", numericCode: "586", name: "Pakistan", continent: "Asia" },
  { code: "PW", numericCode: "585", name: "Palau", continent: "Oceania" },
  { code: "PS", numericCode: "275", name: "Palestine", continent: "Asia" },
  { code: "PA", numericCode: "591", name: "Panama", continent: "North America" },
  { code: "PG", numericCode: "598", name: "Papua New Guinea", continent: "Oceania" },
  { code: "PY", numericCode: "600", name: "Paraguay", continent: "South America" },
  { code: "PE", numericCode: "604", name: "Peru", continent: "South America" },
  { code: "PH", numericCode: "608", name: "Philippines", continent: "Asia" },
  { code: "PL", numericCode: "616", name: "Poland", continent: "Europe" },
  { code: "PT", numericCode: "620", name: "Portugal", continent: "Europe" },
  { code: "QA", numericCode: "634", name: "Qatar", continent: "Asia" },
  { code: "CG", numericCode: "178", name: "Republic of the Congo", continent: "Africa" },
  { code: "RO", numericCode: "642", name: "Romania", continent: "Europe" },
  { code: "RU", numericCode: "643", name: "Russia", continent: "Europe" },
  { code: "RW", numericCode: "646", name: "Rwanda", continent: "Africa" },
  { code: "KN", numericCode: "659", name: "Saint Kitts and Nevis", continent: "North America" },
  { code: "LC", numericCode: "662", name: "Saint Lucia", continent: "North America" },
  {
    code: "VC",
    numericCode: "670",
    name: "Saint Vincent and the Grenadines",
    continent: "North America",
  },
  { code: "WS", numericCode: "882", name: "Samoa", continent: "Oceania" },
  { code: "SM", numericCode: "674", name: "San Marino", continent: "Europe" },
  { code: "ST", numericCode: "678", name: "São Tomé and Príncipe", continent: "Africa" },
  { code: "SA", numericCode: "682", name: "Saudi Arabia", continent: "Asia" },
  { code: "SN", numericCode: "686", name: "Senegal", continent: "Africa" },
  { code: "RS", numericCode: "688", name: "Serbia", continent: "Europe" },
  { code: "SC", numericCode: "690", name: "Seychelles", continent: "Africa" },
  { code: "SL", numericCode: "694", name: "Sierra Leone", continent: "Africa" },
  { code: "SG", numericCode: "702", name: "Singapore", continent: "Asia" },
  { code: "SK", numericCode: "703", name: "Slovakia", continent: "Europe" },
  { code: "SI", numericCode: "705", name: "Slovenia", continent: "Europe" },
  { code: "SB", numericCode: "090", name: "Solomon Islands", continent: "Oceania" },
  { code: "SO", numericCode: "706", name: "Somalia", continent: "Africa" },
  { code: "ZA", numericCode: "710", name: "South Africa", continent: "Africa" },
  { code: "KR", numericCode: "410", name: "South Korea", continent: "Asia" },
  { code: "SS", numericCode: "728", name: "South Sudan", continent: "Africa" },
  { code: "ES", numericCode: "724", name: "Spain", continent: "Europe" },
  { code: "LK", numericCode: "144", name: "Sri Lanka", continent: "Asia" },
  { code: "SD", numericCode: "729", name: "Sudan", continent: "Africa" },
  { code: "SR", numericCode: "740", name: "Suriname", continent: "South America" },
  { code: "SE", numericCode: "752", name: "Sweden", continent: "Europe" },
  { code: "CH", numericCode: "756", name: "Switzerland", continent: "Europe" },
  { code: "SY", numericCode: "760", name: "Syria", continent: "Asia" },
  { code: "TJ", numericCode: "762", name: "Tajikistan", continent: "Asia" },
  { code: "TZ", numericCode: "834", name: "Tanzania", continent: "Africa" },
  { code: "TH", numericCode: "764", name: "Thailand", continent: "Asia" },
  { code: "TL", numericCode: "626", name: "Timor-Leste", continent: "Asia" },
  { code: "TG", numericCode: "768", name: "Togo", continent: "Africa" },
  { code: "TO", numericCode: "776", name: "Tonga", continent: "Oceania" },
  { code: "TT", numericCode: "780", name: "Trinidad and Tobago", continent: "North America" },
  { code: "TN", numericCode: "788", name: "Tunisia", continent: "Africa" },
  { code: "TR", numericCode: "792", name: "Turkey", continent: "Asia" },
  { code: "TM", numericCode: "795", name: "Turkmenistan", continent: "Asia" },
  { code: "TV", numericCode: "798", name: "Tuvalu", continent: "Oceania" },
  { code: "UG", numericCode: "800", name: "Uganda", continent: "Africa" },
  { code: "UA", numericCode: "804", name: "Ukraine", continent: "Europe" },
  { code: "AE", numericCode: "784", name: "United Arab Emirates", continent: "Asia" },
  { code: "GB", numericCode: "826", name: "United Kingdom", continent: "Europe" },
  { code: "US", numericCode: "840", name: "United States", continent: "North America" },
  { code: "UY", numericCode: "858", name: "Uruguay", continent: "South America" },
  { code: "UZ", numericCode: "860", name: "Uzbekistan", continent: "Asia" },
  { code: "VU", numericCode: "548", name: "Vanuatu", continent: "Oceania" },
  { code: "VA", numericCode: "336", name: "Vatican City", continent: "Europe" },
  { code: "VE", numericCode: "862", name: "Venezuela", continent: "South America" },
  { code: "VN", numericCode: "704", name: "Vietnam", continent: "Asia" },
  { code: "YE", numericCode: "887", name: "Yemen", continent: "Asia" },
  { code: "ZM", numericCode: "894", name: "Zambia", continent: "Africa" },
  { code: "ZW", numericCode: "716", name: "Zimbabwe", continent: "Africa" },
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
