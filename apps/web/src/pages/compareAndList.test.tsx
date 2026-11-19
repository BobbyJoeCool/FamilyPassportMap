import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONTINENTS, US_STATES, countriesByContinent } from "@familypassportmap/shared";
import { makePerson, mockFetch } from "../test/api";
import { ListPage } from "./ListPage";
import { WorldListPage } from "./WorldListPage";
import { ComparePage } from "./ComparePage";
import { WorldComparePage } from "./WorldComparePage";

const alice = makePerson({ id: "a", name: "Alice", colorHex: "#3366cc" });
const sam = makePerson({ id: "s", name: "Sam", colorHex: "#00aa00" });

/**
 * The List page's row for one place.
 * @param name - the state or country name.
 * @returns the row element.
 */
function placeRow(name: string): HTMLElement {
  return screen.getByText(name, { selector: "span" }).parentElement!;
}

describe("ListPage (US)", () => {
  it("lists all 50 states in alphabetical order", async () => {
    mockFetch({ "GET /api/people": [alice], "GET /api/visits": [] });
    render(<ListPage />);
    await screen.findByText("Alabama");
    const names = US_STATES.map((s) => s.name);
    const shown = screen.getAllByText((_, el) => el?.tagName === "SPAN" && names.includes(el.textContent ?? ""));
    expect(shown.map((el) => el.textContent)).toEqual(names);
  });

  it("shows each visitor's avatar next to the states they've been to", async () => {
    mockFetch({
      "GET /api/people": [alice, sam],
      "GET /api/visits": [
        { personId: "a", stateCodes: ["CA", "NY"] },
        { personId: "s", stateCodes: ["CA"] },
      ],
    });
    render(<ListPage />);
    await screen.findByText("California");
    expect(within(placeRow("California")).getAllByLabelText(/Alice|Sam/)).toHaveLength(2);
    expect(within(placeRow("New York")).getByLabelText("Alice")).toBeInTheDocument();
    expect(within(placeRow("Texas")).queryAllByLabelText(/Alice|Sam/)).toHaveLength(0);
  });

  it("shows the empty state when there is no one", async () => {
    mockFetch({ "GET /api/people": [], "GET /api/visits": [] });
    render(<ListPage />);
    expect(await screen.findByText(/add a person on the People page first/)).toBeInTheDocument();
    expect(screen.queryByText("Alabama")).not.toBeInTheDocument();
  });
});

describe("WorldListPage", () => {
  it("groups the countries by continent, with each continent's count", async () => {
    mockFetch({ "GET /api/people": [alice], "GET /api/countries": [] });
    render(<WorldListPage />);
    await screen.findByText("France");
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.firstChild?.textContent)).toEqual(CONTINENTS);
    expect(headings[0]).toHaveTextContent(`· ${countriesByContinent("Africa").length} countries`);
  });

  it("shows visitors next to the countries they've been to", async () => {
    mockFetch({ "GET /api/people": [alice, sam], "GET /api/countries": [{ personId: "s", countryCodes: ["JP"] }] });
    render(<WorldListPage />);
    await screen.findByText("Japan");
    expect(within(placeRow("Japan")).getByLabelText("Sam")).toBeInTheDocument();
    expect(within(placeRow("France")).queryAllByLabelText(/Alice|Sam/)).toHaveLength(0);
  });

  it("shows the empty state when there is no one", async () => {
    mockFetch({ "GET /api/people": [], "GET /api/countries": [] });
    render(<WorldListPage />);
    expect(await screen.findByText(/add a person on the People page first/)).toBeInTheDocument();
  });
});

describe("ComparePage (US)", () => {
  it("prompts for a selection, then draws one map per selected Person with their count", async () => {
    mockFetch({
      "GET /api/people": [alice, sam],
      "GET /api/visits": [
        { personId: "a", stateCodes: ["CA", "NY"] },
        { personId: "s", stateCodes: ["CA"] },
      ],
    });
    const { container } = render(<ComparePage />);
    expect(await screen.findByText("Select people above to compare their maps.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Sam" }));
    expect(screen.queryByText("Select people above to compare their maps.")).not.toBeInTheDocument();
    expect(screen.getByText("2/50 states")).toBeInTheDocument();
    expect(screen.getByText("1/50 states")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);

    // Shared (CA) is filled on both maps; NY only on Alice's.
    const fills = (code: string) =>
      [...container.querySelectorAll<SVGElement>(`[data-state-code="${code}"]`)].map((p) => p.style.fill);
    expect(fills("CA")).toEqual(["rgb(51, 102, 204)", "rgb(0, 170, 0)"]);
    expect(fills("NY")).toEqual(["rgb(51, 102, 204)", "rgb(229, 229, 229)"]);
  });

  it("removes a map when its Person is unchecked", async () => {
    mockFetch({ "GET /api/people": [alice, sam], "GET /api/visits": [] });
    const { container } = render(<ComparePage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Alice" }));
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    await userEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("shows the empty state when there is no one", async () => {
    mockFetch({ "GET /api/people": [], "GET /api/visits": [] });
    render(<ComparePage />);
    expect(await screen.findByText(/add a person on the People page first/)).toBeInTheDocument();
  });
});

describe("WorldComparePage", () => {
  it("shows the continent selector only once someone is selected, shared by every map", async () => {
    mockFetch({
      "GET /api/people": [alice, sam],
      "GET /api/countries": [{ personId: "a", countryCodes: ["FR"] }],
    });
    const { container } = render(<WorldComparePage />);
    await screen.findByText("Select people above to compare their maps.");
    expect(screen.queryByRole("group", { name: "Choose a continent" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Sam" }));
    expect(screen.getByText("1/195 countries")).toBeInTheDocument();
    expect(screen.getByText("0/195 countries")).toBeInTheDocument();

    // Both maps follow the one selector: Europe adds the micro-state dots to each.
    await userEvent.click(screen.getByRole("button", { name: "Europe" }));
    expect(container.querySelectorAll('circle[data-country-code="VA"]')).toHaveLength(2);
  });

  it("shows the empty state when there is no one", async () => {
    mockFetch({ "GET /api/people": [], "GET /api/countries": [] });
    render(<WorldComparePage />);
    expect(await screen.findByText(/add a person on the People page first/)).toBeInTheDocument();
  });
});
