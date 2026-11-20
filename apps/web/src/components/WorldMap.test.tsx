import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorldMap } from "./WorldMap";

// Like UsMap.test.tsx, this renders the real react-simple-maps with the bundled world-atlas
// topology (nothing is fetched).

/**
 * The first drawn element (shape or micro-state dot) for one country.
 * @param container - the rendered map.
 * @param code - the country's ISO alpha-2 code.
 * @returns its element.
 */
function countryShape(container: HTMLElement, code: string): SVGElement {
  const shape = container.querySelector<SVGElement>(`[data-country-code="${code}"]`);
  // Missing means the country isn't drawn in this view at all.
  if (!shape) throw new Error(`No shape for ${code}`);
  return shape;
}

describe("WorldMap", () => {
  it("fills visited countries with the Person's color", () => {
    const { container } = render(<WorldMap visitedCountryCodes={["FR"]} color="#3366cc" view="Europe" />);
    expect(countryShape(container, "FR").style.fill).toBe("rgb(51, 102, 204)");
    expect(countryShape(container, "DE").style.fill).toBe("rgb(229, 229, 229)");
  });

  it("toggles a country when clicked in a continent view", () => {
    const onToggleCountry = vi.fn();
    const { container } = render(
      <WorldMap visitedCountryCodes={[]} color="#3366cc" view="Europe" onToggleCountry={onToggleCountry} />,
    );
    fireEvent.click(countryShape(container, "IT"));
    expect(onToggleCountry).toHaveBeenCalledWith("IT");
  });

  it("ignores clicks in the World overview", () => {
    const onToggleCountry = vi.fn();
    const { container } = render(
      <WorldMap visitedCountryCodes={[]} color="#3366cc" view="World" onToggleCountry={onToggleCountry} />,
    );
    fireEvent.click(countryShape(container, "IT"));
    expect(onToggleCountry).not.toHaveBeenCalled();
  });

  it("gives micro-states a clickable dot in their continent view only", () => {
    const onToggleCountry = vi.fn();
    const { container, rerender } = render(
      <WorldMap visitedCountryCodes={[]} color="#3366cc" view="Europe" onToggleCountry={onToggleCountry} />,
    );
    const dot = container.querySelector('circle[data-country-code="VA"]');
    expect(dot).not.toBeNull();
    fireEvent.click(dot!);
    expect(onToggleCountry).toHaveBeenCalledWith("VA");

    rerender(<WorldMap visitedCountryCodes={[]} color="#3366cc" view="World" onToggleCountry={onToggleCountry} />);
    expect(container.querySelector('circle[data-country-code="VA"]')).toBeNull();
  });

  it("labels countries with their alpha-3 code and shows the name on hover", () => {
    const { container } = render(<WorldMap visitedCountryCodes={[]} color="#3366cc" view="Europe" />);
    expect(screen.getByText("FRA")).toBeInTheDocument();
    fireEvent.mouseEnter(countryShape(container, "FR"));
    expect(screen.getByText("France")).toBeInTheDocument();
  });

  it("is read-only without a handler, even in a continent view", () => {
    const { container } = render(<WorldMap visitedCountryCodes={[]} color="#3366cc" view="Asia" />);
    expect(countryShape(container, "JP").style.cursor).toBe("default");
  });
});
