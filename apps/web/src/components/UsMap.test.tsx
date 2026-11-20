import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { UsMap } from "./UsMap";

// The real react-simple-maps and us-atlas topology render here: the topology is bundled JSON
// (nothing is fetched), so the test exercises the same shapes the browser draws.

/**
 * The drawn shape for one state.
 * @param container - the rendered map.
 * @param code - the state's USPS code.
 * @returns its <path>.
 */
function statePath(container: HTMLElement, code: string): SVGPathElement {
  const path = container.querySelector<SVGPathElement>(`path[data-state-code="${code}"]`);
  // A missing shape means the map didn't render that state at all.
  if (!path) throw new Error(`No shape for ${code}`);
  return path;
}

describe("UsMap", () => {
  it("draws one clickable shape for each of the 50 states", () => {
    const { container } = render(<UsMap visitedStateCodes={[]} color="#3366cc" />);
    expect(container.querySelectorAll("path[data-state-code]")).toHaveLength(50);
  });

  it("fills visited states with the Person's color and the rest gray", () => {
    const { container } = render(<UsMap visitedStateCodes={["CA"]} color="#3366cc" />);
    expect(statePath(container, "CA").style.fill).toBe("rgb(51, 102, 204)");
    expect(statePath(container, "NY").style.fill).toBe("rgb(229, 229, 229)");
  });

  it("labels each state with its abbreviation", () => {
    render(<UsMap visitedStateCodes={[]} color="#3366cc" />);
    expect(screen.getByText("TX")).toBeInTheDocument();
    expect(screen.getByText("RI")).toBeInTheDocument();
  });

  it("calls onToggleState with the clicked state's code", () => {
    const onToggleState = vi.fn();
    const { container } = render(<UsMap visitedStateCodes={[]} color="#3366cc" onToggleState={onToggleState} />);
    fireEvent.click(statePath(container, "WI"));
    expect(onToggleState).toHaveBeenCalledWith("WI");
  });

  it("is read-only without a handler: clicking does nothing and shows no pointer", () => {
    const { container } = render(<UsMap visitedStateCodes={[]} color="#3366cc" />);
    fireEvent.click(statePath(container, "WI"));
    expect(statePath(container, "WI").style.cursor).toBe("default");
  });

  it("shows the state's full name while hovered", () => {
    const { container } = render(<UsMap visitedStateCodes={[]} color="#3366cc" />);
    fireEvent.mouseEnter(statePath(container, "NM"));
    expect(screen.getByText("New Mexico")).toBeInTheDocument();
    fireEvent.mouseLeave(statePath(container, "NM"));
    expect(screen.queryByText("New Mexico")).not.toBeInTheDocument();
  });
});
