// The guest demo's made-up family. Every demo visit starts from exactly this, and a reload
// starts over from it (nothing is saved). Names only: the avatars are original "passport stamp"
// monograms, not pictures of anyone.

/** A photo bundled with the seed: its stored file name, MIME type and file contents. */
export interface DemoSeedPhoto {
  fileName: string;
  type: string;
  contents: string;
}

/** One Person in a seed, with the places they've visited. */
export interface DemoSeedPerson {
  name: string;
  colorHex: string;
  /** True for exactly one Person: the visitor's own Primary Person ("You"). */
  isPrimary?: boolean;
  states: string[];
  countries: string[];
  photo?: DemoSeedPhoto;
}

/** The starting data for a demo store. */
export interface DemoSeed {
  people: DemoSeedPerson[];
}

/**
 * An original avatar: a round "passport stamp" with a dashed ring, the Person's initial and a
 * small plane, in their color. Plain SVG text, so the demo build needs no image files.
 * @param initial - the letter in the middle.
 * @param colorHex - the stamp's ink color.
 * @returns the SVG document.
 */
export function stampAvatarSvg(initial: string, colorHex: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">`,
    `<rect width="256" height="256" fill="#fdf8ec"/>`,
    `<circle cx="128" cy="128" r="104" fill="none" stroke="${colorHex}" stroke-width="10"/>`,
    `<circle cx="128" cy="128" r="86" fill="none" stroke="${colorHex}" stroke-width="4" stroke-dasharray="10 8"/>`,
    `<text x="128" y="152" text-anchor="middle" font-family="Georgia, serif" font-size="88" font-weight="700" fill="${colorHex}">${initial}</text>`,
    `<path d="M128 62 l6 14 h18 l-18 6 l6 14 l-12 -8 l-12 8 l6 -14 l-18 -6 h18 z" fill="${colorHex}"/>`,
    `<text x="128" y="200" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="16" letter-spacing="4" fill="${colorHex}">VISITED</text>`,
    `</svg>`,
  ].join("");
}

/**
 * The sample family: Homer is "You", with Marge, Bart and Lisa. Their visits overlap so Compare
 * has something to show, and between them every continent has at least one visit.
 */
export const DEMO_SEED: DemoSeed = {
  people: [
    {
      name: "Homer",
      colorHex: "#2563EB",
      isPrimary: true,
      states: ["CA", "NV", "AZ", "NM", "TX", "FL", "GA", "NY", "NJ", "PA", "OH", "MI", "IL", "WI", "MN", "IA", "MO", "KY", "TN", "CO"],
      countries: ["CA", "MX", "GB", "FR", "IT", "BR", "JP", "AU"],
    },
    {
      name: "Marge",
      colorHex: "#059669",
      states: ["CA", "NV", "AZ", "FL", "GA", "NY", "PA", "OH", "IL", "MA", "ME", "VT"],
      countries: ["CA", "GB", "FR", "IT", "ES"],
      photo: { fileName: "demo-seed-marge.svg", type: "image/svg+xml", contents: stampAvatarSvg("M", "#059669") },
    },
    {
      name: "Bart",
      colorHex: "#EA580C",
      states: ["CA", "FL", "TX", "NY", "HI", "AK", "CO", "IL"],
      countries: ["MX", "AU", "JP"],
    },
    {
      name: "Lisa",
      colorHex: "#9333EA",
      states: ["CA", "NY", "MA", "WA", "OR", "IL", "FL", "VA", "MD", "NC"],
      countries: ["FR", "SE", "ZA", "KE", "IN", "PE"],
      photo: { fileName: "demo-seed-lisa.svg", type: "image/svg+xml", contents: stampAvatarSvg("L", "#9333EA") },
    },
  ],
};
