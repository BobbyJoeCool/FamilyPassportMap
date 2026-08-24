import { useState } from "react";
import { geoCentroid } from "d3-geo";
import { ComposableMap, Geographies, Geography, Marker, Annotation } from "react-simple-maps";
import { FIPS_TO_USPS, US_STATES } from "@familypassportmap/shared";
import statesTopoJson from "us-atlas/states-10m.json";

const UNVISITED_FILL = "#e5e5e5";
const UNMAPPED_FILL = "#f3f3f3"; // DC/territories — out of v1 scope, shown but not interactive

/** Lookup from USPS code to full state name. */
const CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.code, s.name]),
);

/**
 * Small northeast states that are too compact to place a label inside — the abbreviation
 * is rendered as an Annotation with a connector line offset by [dx, dy] from the centroid.
 */
const ANNOTATION_OFFSETS: Record<string, [number, number]> = {
  VT: [35, -8],
  NH: [34, 2],
  MA: [36, -1],
  RI: [28, 2],
  CT: [35, 10],
  NJ: [34, 1],
  DE: [33, 0],
  MD: [47, 10],
};

/**
 * Manual centroid nudges for states whose geographic centroid doesn't land in a
 * visually centered spot on the AlbersUsa projection (e.g. FL panhandle, MI
 * upper/lower peninsula, LA coastline).
 */
const CENTROID_NUDGES: Record<string, [number, number]> = {
  FL: [1.5, -1],
  MI: [1, 2],
  LA: [-1, 0.5],
  HI: [1, 1],
  CA: [0, 1.5],
  ID: [0, 0.5],
  AK: [0, 0],
};

interface UsMapProps {
  visitedStateCodes: string[];
  color: string;
  /** Omit for a read-only map (e.g. Compare view in Phase 3). */
  onToggleState?: (stateCode: string) => void;
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
 * Returns a text color (black or white) that will be legible over the given background,
 * using the WCAG relative-luminance formula.
 * @param bgHex - the background color as a hex string.
 * @returns "#ffffff" for dark backgrounds, "#333333" for light backgrounds.
 */
function contrastText(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex);
  // WCAG relative luminance — gamma-correct each channel, then weight.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#333333" : "#ffffff";
}

/**
 * Renders an interactive (or read-only) choropleth of the 50 US states, filled in the
 * given color for every state in `visitedStateCodes`. Each state shows its two-letter
 * abbreviation in a color that contrasts with the fill, and hovering over a state
 * shows a tooltip pill with the full state name.
 * @param visitedStateCodes - the state codes to render as visited.
 * @param color - the fill color used for visited states.
 * @param onToggleState - called with a state's code when it's clicked; omit to render
 * a non-interactive map.
 */
export function UsMap({ visitedStateCodes, color, onToggleState }: UsMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  /** The contrast-aware text color for labels on visited states. */
  const visitedTextColor = contrastText(color);
  /** The contrast-aware text color for labels on unvisited (gray) states. */
  const unvisitedTextColor = contrastText(UNVISITED_FILL);

  return (
    <div className="relative">
      {/* Hover pill — floats above the map when a state is hovered */}
      {hoveredState && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-sm font-semibold shadow-md pointer-events-none transition-opacity duration-150"
          style={{ backgroundColor: color, color: visitedTextColor }}
        >
          {CODE_TO_NAME[hoveredState] ?? hoveredState}
        </div>
      )}

      <ComposableMap projection="geoAlbersUsa" width={800} height={500}>
        <Geographies geography={statesTopoJson}>
          {({ geographies }) => (
            <>
              {/* Layer 1: filled state shapes */}
              {geographies.map((geo) => {
                const stateCode = FIPS_TO_USPS[geo.id as string];
                // This shape isn't one of the 50 tracked states (DC/territory) — render it
                // as a non-interactive placeholder rather than skipping it entirely.
                if (!stateCode) {
                  return <Geography key={geo.rsmKey} geography={geo} fill={UNMAPPED_FILL} style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }} />;
                }

                const visited = visitedStateCodes.includes(stateCode);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onToggleState?.(stateCode)}
                    onMouseEnter={() => setHoveredState(stateCode)}
                    onMouseLeave={() => setHoveredState(null)}
                    style={{
                      default: {
                        fill: visited ? color : UNVISITED_FILL,
                        stroke: "#fff",
                        strokeWidth: 0.5,
                        outline: "none",
                        cursor: onToggleState ? "pointer" : "default",
                      },
                      hover: {
                        fill: visited ? color : UNVISITED_FILL,
                        stroke: "#fff",
                        strokeWidth: 0.5,
                        outline: "none",
                        opacity: onToggleState ? 0.8 : 1,
                        cursor: onToggleState ? "pointer" : "default",
                      },
                      pressed: {
                        fill: visited ? color : UNVISITED_FILL,
                        stroke: "#fff",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                    }}
                  />
                );
              })}

              {/* Layer 2: state abbreviation labels — rendered after shapes so they sit on top */}
              {geographies.map((geo) => {
                const stateCode = FIPS_TO_USPS[geo.id as string];
                // Skip unmapped territories/DC.
                if (!stateCode) return null;

                const centroid = geoCentroid(geo);
                // Skip states whose centroid falls outside the projection (shouldn't happen
                // with AlbersUsa, but guard against it).
                if (centroid[0] === 0 && centroid[1] === 0) return null;

                const visited = visitedStateCodes.includes(stateCode);
                const textColor = visited ? visitedTextColor : unvisitedTextColor;

                // Apply manual nudges for states whose centroid isn't visually centered.
                const nudge = CENTROID_NUDGES[stateCode];
                const adjustedCentroid: [number, number] = nudge
                  ? [centroid[0] + nudge[0], centroid[1] + nudge[1]]
                  : [centroid[0], centroid[1]];

                const offsets = ANNOTATION_OFFSETS[stateCode];
                // Small NE states get an Annotation with a connector line.
                if (offsets) {
                  return (
                    <Annotation
                      key={`label-${stateCode}`}
                      subject={adjustedCentroid}
                      dx={offsets[0]}
                      dy={offsets[1]}
                      connectorProps={{ stroke: "#666", strokeWidth: 0.5 }}
                    >
                      <text
                        x={4}
                        textAnchor="start"
                        alignmentBaseline="middle"
                        style={{
                          fontSize: 8,
                          fontWeight: 600,
                          fill: "#ffffff",
                          pointerEvents: "none",
                        }}
                      >
                        {stateCode}
                      </text>
                    </Annotation>
                  );
                }

                // Regular states — label at the centroid.
                return (
                  <Marker key={`label-${stateCode}`} coordinates={adjustedCentroid}>
                    <text
                      textAnchor="middle"
                      alignmentBaseline="central"
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        fill: textColor,
                        pointerEvents: "none",
                      }}
                    >
                      {stateCode}
                    </text>
                  </Marker>
                );
              })}
            </>
          )}
        </Geographies>
      </ComposableMap>
    </div>
  );
}
