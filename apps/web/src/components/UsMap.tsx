import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { FIPS_TO_USPS } from "@familypassportmap/shared";
import statesTopoJson from "us-atlas/states-10m.json";

const UNVISITED_FILL = "#e5e5e5";
const UNMAPPED_FILL = "#f3f3f3"; // DC/territories — out of v1 scope, shown but not interactive

interface UsMapProps {
  visitedStateCodes: string[];
  color: string;
  /** Omit for a read-only map (e.g. Compare view in Phase 3). */
  onToggleState?: (stateCode: string) => void;
}

export function UsMap({ visitedStateCodes, color, onToggleState }: UsMapProps) {
  return (
    <ComposableMap projection="geoAlbersUsa" width={800} height={500}>
      <Geographies geography={statesTopoJson}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const stateCode = FIPS_TO_USPS[geo.id as string];
            if (!stateCode) {
              return <Geography key={geo.rsmKey} geography={geo} fill={UNMAPPED_FILL} style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }} />;
            }

            const visited = visitedStateCodes.includes(stateCode);
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => onToggleState?.(stateCode)}
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
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
