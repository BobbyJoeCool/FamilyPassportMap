import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { COUNTRIES } from "@familypassportmap/shared";
import { makePerson } from "../test/api";
import { StateCounter } from "./StateCounter";
import { ContinentSelector } from "./ContinentSelector";
import { SectionTabs } from "./SectionTabs";
import { PersonAvatar } from "./PersonAvatar";

describe("StateCounter", () => {
  it("shows the count out of 50 states by default", () => {
    // 0, 1 and many all use the same "n/50 states" wording (the label doesn't pluralize).
    for (const count of [0, 1, 37]) {
      const { unmount } = render(<StateCounter count={count} />);
      expect(screen.getByText(`${count}/50 states`)).toBeInTheDocument();
      unmount();
    }
  });

  it("takes a custom total and label for countries", () => {
    render(<StateCounter count={12} total={COUNTRIES.length} label="countries" />);
    expect(screen.getByText("12/195 countries")).toBeInTheDocument();
  });
});

describe("ContinentSelector", () => {
  it("offers World and the six continents, in order", () => {
    render(<ContinentSelector value="World" onChange={() => {}} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "World",
      "Africa",
      "Asia",
      "Europe",
      "North America",
      "Oceania",
      "South America",
    ]);
  });

  it("marks only the selected view as pressed", () => {
    render(<ContinentSelector value="Asia" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Asia" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "World" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the clicked view", async () => {
    const onChange = vi.fn();
    render(<ContinentSelector value="World" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Oceania" }));
    expect(onChange).toHaveBeenCalledWith("Oceania");
  });
});

describe("SectionTabs", () => {
  /**
   * Renders the tabs at a given route.
   * @param section - which section's tabs.
   * @param path - the current route.
   */
  function renderTabs(section: "us" | "world", path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <SectionTabs section={section} />
      </MemoryRouter>,
    );
  }

  it("links Map, Compare and List inside the section", () => {
    renderTabs("world", "/world/map");
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/world/map");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/world/compare");
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("href", "/world/list");
  });

  it("highlights the tab for the current route", () => {
    renderTabs("us", "/us/compare");
    expect(screen.getByRole("link", { name: "Compare" }).className).toContain("border-[var(--color-primary)]");
    expect(screen.getByRole("link", { name: "Map" }).className).toContain("border-transparent");
  });
});

describe("PersonAvatar", () => {
  it("shows the uploaded photo when there is one", () => {
    render(<PersonAvatar person={makePerson({ name: "Alice", profilePicturePath: "uploads/a.png" })} />);
    expect(screen.getByRole("img", { name: "Alice" })).toHaveAttribute("src", "/uploads/a.png");
  });

  it("falls back to up to two initials on the Person's color", () => {
    render(<PersonAvatar person={makePerson({ name: "mary jo anne smith", colorHex: "#aa0000" })} />);
    const avatar = screen.getByLabelText("mary jo anne smith");
    expect(avatar).toHaveTextContent(/^MJ$/);
    expect(avatar.style.backgroundColor).toBe("rgb(170, 0, 0)");
  });

  it("uses one initial for a one-word name and ignores extra spaces", () => {
    render(<PersonAvatar person={makePerson({ name: "  Zoe  " })} />);
    // The label query normalizes whitespace, so the trimmed name finds it.
    expect(screen.getByLabelText("Zoe")).toHaveTextContent(/^Z$/);
  });

  it("sizes itself from the size prop", () => {
    render(<PersonAvatar person={makePerson({ name: "Al" })} size={24} />);
    expect(screen.getByLabelText("Al").style.width).toBe("24px");
  });
});
