import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, makePerson, mockFetch } from "../test/api";
import { MapPage } from "./MapPage";
import { WorldMapPage } from "./WorldMapPage";

const alice = makePerson({ id: "a", name: "Alice", colorHex: "#3366cc" });
const sam = makePerson({ id: "s", name: "Sam", colorHex: "#00aa00" });

/**
 * Waits for a map shape to appear and returns it.
 * @param selector - CSS selector for the shape.
 * @returns the element.
 */
async function shape(selector: string): Promise<Element> {
  return waitFor(() => {
    const el = document.querySelector(selector);
    // Keep waiting until the map has drawn this shape.
    if (!el) throw new Error(`waiting for ${selector}`);
    return el;
  });
}

describe("MapPage (US)", () => {
  it("shows the first Person's visited states and count", async () => {
    mockFetch({ "GET /api/people": [alice, sam], "GET /api/people/a/visits": ["CA", "NY"] });
    render(<MapPage />);
    expect(await screen.findByText("2/50 states")).toBeInTheDocument();
    expect(((await shape('[data-state-code="CA"]')) as SVGElement).style.fill).toBe("rgb(51, 102, 204)");
  });

  it("clicking a state marks it, updating the count right away", async () => {
    const { calls } = mockFetch({
      "GET /api/people": [alice],
      "GET /api/people/a/visits": [],
      "PUT /api/people/a/visits/TX": jsonResponse(204),
    });
    render(<MapPage />);
    await screen.findByText("0/50 states");
    fireEvent.click(await shape('[data-state-code="TX"]'));
    expect(await screen.findByText("1/50 states")).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ method: "PUT", url: "/api/people/a/visits/TX" });
  });

  it("clicking a visited state unmarks it", async () => {
    const { calls } = mockFetch({
      "GET /api/people": [alice],
      "GET /api/people/a/visits": ["TX"],
      "DELETE /api/people/a/visits/TX": jsonResponse(204),
    });
    render(<MapPage />);
    await screen.findByText("1/50 states");
    fireEvent.click(await shape('[data-state-code="TX"]'));
    expect(await screen.findByText("0/50 states")).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", url: "/api/people/a/visits/TX" });
  });

  it("rolls back and shows the error when saving fails", async () => {
    mockFetch({
      "GET /api/people": [alice],
      "GET /api/people/a/visits": [],
      "PUT /api/people/a/visits/TX": jsonResponse(500, { error: "Could not save" }),
    });
    render(<MapPage />);
    await screen.findByText("0/50 states");
    fireEvent.click(await shape('[data-state-code="TX"]'));
    expect(await screen.findByText("Could not save")).toBeInTheDocument();
    expect(await screen.findByText("0/50 states")).toBeInTheDocument();
  });

  it("switches to another Person's map", async () => {
    mockFetch({
      "GET /api/people": [alice, sam],
      "GET /api/people/a/visits": ["CA"],
      "GET /api/people/s/visits": ["CA", "OR", "WA"],
    });
    render(<MapPage />);
    await screen.findByText("1/50 states");
    await userEvent.selectOptions(screen.getByLabelText("Person"), "Sam");
    expect(await screen.findByText("3/50 states")).toBeInTheDocument();
  });

  it("asks for a Person first when there is no one", async () => {
    mockFetch({ "GET /api/people": [] });
    render(<MapPage />);
    expect(await screen.findByText(/add a person on the People page first/)).toBeInTheDocument();
  });
});

describe("WorldMapPage", () => {
  it("starts on the view-only World overview", async () => {
    mockFetch({ "GET /api/people": [alice], "GET /api/people/a/countries": ["FR"] });
    render(<WorldMapPage />);
    expect(await screen.findByText("1/195 countries")).toBeInTheDocument();
    expect(screen.getByText("Pick a continent to mark countries.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "World" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks a country after choosing its continent", async () => {
    const { calls } = mockFetch({
      "GET /api/people": [alice],
      "GET /api/people/a/countries": [],
      "PUT /api/people/a/countries/IT": jsonResponse(204),
    });
    render(<WorldMapPage />);
    await screen.findByText("0/195 countries");
    // A click in the overview changes nothing.
    fireEvent.click(await shape('[data-country-code="IT"]'));
    expect(calls.some((c) => c.method === "PUT")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Europe" }));
    expect(screen.queryByText("Pick a continent to mark countries.")).not.toBeInTheDocument();
    fireEvent.click(await shape('[data-country-code="IT"]'));
    expect(await screen.findByText("1/195 countries")).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ method: "PUT", url: "/api/people/a/countries/IT" });
  });

  it("rolls back and shows the error when saving fails", async () => {
    mockFetch({
      "GET /api/people": [alice],
      "GET /api/people/a/countries": [],
      "PUT /api/people/a/countries/IT": jsonResponse(500, { error: "Could not save" }),
    });
    render(<WorldMapPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Europe" }));
    fireEvent.click(await shape('[data-country-code="IT"]'));
    expect(await screen.findByText("Could not save")).toBeInTheDocument();
    expect(await screen.findByText("0/195 countries")).toBeInTheDocument();
  });

  it("asks for a Person first when there is no one", async () => {
    mockFetch({ "GET /api/people": [] });
    render(<WorldMapPage />);
    expect(await screen.findByText(/add a person on the People page first/)).toBeInTheDocument();
  });
});
