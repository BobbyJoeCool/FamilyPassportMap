import { useState } from "react";
import { geoEqualEarth, type GeoProjection } from "d3-geo";
import type { GeoJSON } from "geojson";
import { ComposableMap, Geographies, Geography, type ProjectionFunction } from "react-simple-maps";
import { COUNTRIES, ISO_NUMERIC_TO_ALPHA2, type Continent } from "@familypassportmap/shared";
import countriesTopoJson from "world-atlas/countries-50m.json";

/** Which part of the world the map is framed on: the whole-world overview or one continent. */
export type WorldView = Continent | "World";

const MAP_WIDTH = 800;
const MAP_HEIGHT = 500;
const FRAME_PADDING = 12;

const UNVISITED_FILL = "#e5e5e5";
const UNMAPPED_FILL = "#f3f3f3"; // dependent territories, non-UN states, Antarctica — shown but inert

const UNVISITED_MARKER_FILL = "#d1d5db";
// One outline for every marker, visited or not, so dots read at the same size and a visited dot
// still stands out when it sits on its own same-colored polygon (e.g. Vatican City on Italy).
const MARKER_STROKE = "#6b7280";
const MARKER_RADIUS = 5;
const MARKER_HIT_RADIUS = 8;

/** Lookup from ISO alpha-2 code to the country's display name. */
const CODE_TO_NAME: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name]));

/** Lookup from ISO alpha-2 code to the country's continent. */
const CODE_TO_CONTINENT: Record<string, Continent> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.continent]));

/**
 * Capital `[lon, lat]` for every country too small to click as a polygon in its own continent's
 * view — total projected area under 15 square units in the 800×500 frame, measured against
 * `countries-50m.json` — plus Tuvalu, which has no polygon at all. Each gets a clickable dot.
 */
const MICRO_STATE_MARKERS: Record<string, [number, number]> = {
  // Africa
  CV: [-23.51, 14.93], // Praia
  KM: [43.26, -11.7], // Moroni
  MU: [57.5, -20.16], // Port Louis
  SC: [55.45, -4.62], // Victoria
  ST: [6.73, 0.34], // São Tomé
  // Asia
  BH: [50.59, 26.23], // Manama
  MV: [73.51, 4.18], // Malé
  SG: [103.82, 1.35], // Singapore
  // Europe
  AD: [1.52, 42.51], // Andorra la Vella
  LI: [9.52, 47.14], // Vaduz
  MC: [7.42, 43.74], // Monaco
  MT: [14.51, 35.9], // Valletta
  SM: [12.45, 43.94], // San Marino
  VA: [12.45, 41.9], // Vatican City
  // North America
  AG: [-61.85, 17.12], // St. John's
  BB: [-59.62, 13.1], // Bridgetown
  DM: [-61.39, 15.3], // Roseau
  GD: [-61.75, 12.05], // St. George's
  KN: [-62.72, 17.3], // Basseterre
  LC: [-61.0, 14.01], // Castries
  VC: [-61.23, 13.16], // Kingstown
  // Oceania
  FM: [158.16, 6.92], // Palikir
  KI: [173.03, 1.33], // South Tarawa
  MH: [171.38, 7.09], // Majuro
  NR: [166.92, -0.55], // Yaren
  PW: [134.62, 7.5], // Ngerulmud
  TO: [-175.2, -21.14], // Nuku'alofa
  TV: [179.19, -8.52], // Funafuti
  WS: [-171.76, -13.83], // Apia
};

/**
 * SVG-unit `[dx, dy]` offsets for markers whose capitals sit too close together to click
 * separately. The Lesser Antilles are fanned out into a north-to-south column in the Atlantic
 * (x ≈ 760, 15 units apart), each with a connector line back to its true location. Derived from
 * the current North America entry in `VIEWPORTS` — re-derive these if that viewport changes.
 */
const MARKER_OFFSETS: Record<string, [number, number]> = {
  KN: [54, -31],
  AG: [49, -17],
  DM: [44, -18],
  LC: [41, -14],
  VC: [42, -6],
  BB: [32, 8],
  GD: [45, 14],
};

/**
 * Each continent's viewport as a `[west, south, east, north]` lon/lat bounding box. `east` may
 * exceed 180 so a box can cross the antimeridian (Oceania). Hand-tuned so each continent's
 * tracked countries are fully in frame without far-flung overseas territories (French Guiana,
 * the Azores, Easter Island) dragging the view out.
 */
const VIEWPORTS: Record<Continent, [number, number, number, number]> = {
  Africa: [-20, -36, 53, 38],
  Asia: [25, -12, 150, 56],
  Europe: [-25, 34, 45, 71],
  "North America": [-170, 6, -52, 72],
  Oceania: [110, -48, 190, 14],
  "South America": [-82, -56, -34, 13],
};

/**
 * Builds a GeoJSON MultiPoint tracing the perimeter of a lon/lat box. Sampling the edges
 * (rather than just the four corners) lets `fitExtent` account for how the projection curves
 * lines of latitude and longitude.
 * @param box - the `[west, south, east, north]` bounding box.
 * @returns a MultiPoint feature along the box's edges.
 */
function boxOutline([west, south, east, north]: [number, number, number, number]): GeoJSON {
  const steps = 16;
  const coordinates: [number, number][] = [];
  // Walk each edge in `steps` increments: along the south and north edges in longitude, and
  // along the west and east edges in latitude.
  for (let i = 0; i <= steps; i++) {
    const lon = west + ((east - west) * i) / steps;
    const lat = south + ((north - south) * i) / steps;
    coordinates.push([lon, south], [lon, north], [west, lat], [east, lat]);
  }
  return { type: "MultiPoint", coordinates };
}

/**
 * Builds the fixed projection for one view. Continents are rotated so the box's center
 * longitude becomes the central meridian (which keeps Oceania contiguous across the
 * antimeridian), then fitted to the map frame.
 * @param view - the view to build a projection for.
 * @returns a d3 Equal Earth projection framed on that view.
 */
function buildProjection(view: WorldView): GeoProjection {
  const extent: [[number, number], [number, number]] = [
    [FRAME_PADDING, FRAME_PADDING],
    [MAP_WIDTH - FRAME_PADDING, MAP_HEIGHT - FRAME_PADDING],
  ];

  // The overview fits the whole globe, with the default (unrotated) central meridian.
  if (view === "World") {
    return geoEqualEarth().fitExtent(extent, { type: "Sphere" });
  }

  const box = VIEWPORTS[view];
  const centerLon = (box[0] + box[2]) / 2;
  return geoEqualEarth().rotate([-centerLon, 0]).fitExtent(extent, boxOutline(box));
}

/**
 * One prebuilt projection per view. Built once at module load so each view's projection keeps
 * a stable identity — react-simple-maps recomputes every path whenever the projection changes.
 */
const PROJECTIONS = Object.fromEntries(
  (["World", ...Object.keys(VIEWPORTS)] as WorldView[]).map((view) => [view, buildProjection(view)]),
) as Record<WorldView, GeoProjection>;

interface WorldMapProps {
  visitedCountryCodes: string[];
  color: string;
  view: WorldView;
  /** Omit for a read-only map (e.g. World Compare). Ignored in the "World" overview. */
  onToggleCountry?: (countryCode: string) => void;
}

/**
 * Parses a hex color string into its [R, G, B] components (0–255 each).
 * @param hex - a color string like "#a3c1f0" or "#fff".
 * @returns a three-element tuple of red, green, blue values.
 */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  // Expand shorthand (#abc → #aabbcc).
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Returns a text color (dark or white) that will be legible over the given background.
 * @param bgHex - the background color as a hex string.
 * @returns "#ffffff" for dark backgrounds, "#333333" for light backgrounds.
 */
function contrastText(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex);
  // Perceived brightness — weight each channel by how strongly the eye responds to it.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#333333" : "#ffffff";
}

/**
 * Renders the world map framed on either the whole world or one continent, filling every
 * visited country in the given color. Hovering a tracked country shows its name; clicking
 * one toggles it, but only when a handler is provided and a continent (not the World
 * overview) is selected. Countries outside the selected continent stay clickable if visible.
 * In a continent view, that continent's micro-states also get a dot at their capital, following
 * the same hover/click rules as polygons.
 * @param visitedCountryCodes - the ISO alpha-2 codes to render as visited.
 * @param color - the fill color used for visited countries.
 * @param view - "World" for the overview, or the continent to zoom to.
 * @param onToggleCountry - called with a country's code when it's clicked; omit for a
 * read-only map.
 */
export function WorldMap({ visitedCountryCodes, color, view, onToggleCountry }: WorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const interactive = Boolean(onToggleCountry) && view !== "World";
  const pillTextColor = contrastText(color);

  return (
    <div className="relative">
      {/* Hover pill — floats above the map when a country is hovered */}
      {hoveredCountry && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-sm font-semibold shadow-md pointer-events-none"
          style={{ backgroundColor: color, color: pillTextColor }}
        >
          {CODE_TO_NAME[hoveredCountry] ?? hoveredCountry}
        </div>
      )}

      <ComposableMap
        // react-simple-maps v3 uses a function-valued `projection` as the projection itself,
        // but its type definitions describe a factory — cast to satisfy them.
        projection={PROJECTIONS[view] as unknown as ProjectionFunction}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="rounded-lg bg-[var(--color-bg-card)]"
      >
        <Geographies geography={countriesTopoJson}>
          {({ geographies }) =>
            // One shape per topology geometry. Keyed by rsmKey, since some geometries have no
            // id and id "036" is shared by two of them.
            geographies.map((geo) => {
              const countryCode = geo.id ? ISO_NUMERIC_TO_ALPHA2[geo.id as string] : undefined;

              // Not one of the 195 tracked countries (territory, non-UN state, Antarctica, or a
              // geometry with no id) — render it as inert background.
              if (!countryCode) {
                const inert = { fill: UNMAPPED_FILL, stroke: "#fff", strokeWidth: 0.5, outline: "none" };
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{ default: inert, hover: inert, pressed: inert }}
                  />
                );
              }

              const fill = visitedCountryCodes.includes(countryCode) ? color : UNVISITED_FILL;
              const base = {
                fill,
                stroke: "#fff",
                strokeWidth: 0.5,
                outline: "none",
                cursor: interactive ? "pointer" : "default",
              };
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => {
                    // Clicks only count when zoomed into a continent with a handler attached.
                    if (interactive) onToggleCountry?.(countryCode);
                  }}
                  onMouseEnter={() => setHoveredCountry(countryCode)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  style={{
                    default: base,
                    hover: { ...base, opacity: interactive ? 0.8 : 1 },
                    pressed: base,
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Micro-state markers for the selected continent, drawn on top of the shapes. None in
            the World overview, where nothing is clickable and 29 dots would only clutter. */}
        {view !== "World" &&
          Object.entries(MICRO_STATE_MARKERS)
            .filter(([countryCode]) => CODE_TO_CONTINENT[countryCode] === view)
            .map(([countryCode, coordinates]) => {
              const point = PROJECTIONS[view](coordinates);
              // A point the projection can't place (shouldn't happen for in-view capitals) is skipped.
              if (!point) return null;

              const [x, y] = point;
              const [dx, dy] = MARKER_OFFSETS[countryCode] ?? [0, 0];
              const offset = dx !== 0 || dy !== 0;
              const visited = visitedCountryCodes.includes(countryCode);
              return (
                <g key={`marker-${countryCode}`}>
                  {/* Crowded markers are drawn away from their capital, so show where they belong. */}
                  {offset && (
                    <>
                      <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={MARKER_STROKE} strokeWidth={0.5} />
                      <circle cx={x} cy={y} r={1.2} fill={MARKER_STROKE} />
                    </>
                  )}
                  <circle
                    cx={x + dx}
                    cy={y + dy}
                    r={MARKER_RADIUS}
                    fill={visited ? color : UNVISITED_MARKER_FILL}
                    stroke={MARKER_STROKE}
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                  {/* Invisible, larger hit area so the dot is easier to hover and tap. */}
                  <circle
                    cx={x + dx}
                    cy={y + dy}
                    r={MARKER_HIT_RADIUS}
                    fill="transparent"
                    style={{ cursor: interactive ? "pointer" : "default" }}
                    onClick={() => {
                      // Same rule as polygons: only a continent view with a handler toggles.
                      if (interactive) onToggleCountry?.(countryCode);
                    }}
                    onMouseEnter={() => setHoveredCountry(countryCode)}
                    onMouseLeave={() => setHoveredCountry(null)}
                  />
                </g>
              );
            })}
      </ComposableMap>
    </div>
  );
}
