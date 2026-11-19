import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import type { Person } from "@familypassportmap/shared";
import { jsonResponse, makePerson, mockFetch, type FetchCall } from "../test/api";
import { PeoplePage } from "./PeoplePage";

let people: Person[];
let calls: FetchCall[];

/**
 * Fakes the People API with an in-memory list, so adds, renames and deletes show up when the
 * page reloads. Visits are fixed: Alice has 2 states and 1 country.
 * @param owned - how many People the allowance says the User owns (defaults to the list size).
 */
function fakeServer(owned?: number) {
  ({ calls } = mockFetch({
    "GET /api/people": () => people,
    "GET /api/people/allowance": () => ({ owned: owned ?? people.length, max: 10 }),
    "GET /api/visits": [{ personId: "me", stateCodes: ["CA", "NY"] }],
    "GET /api/countries": [{ personId: "me", countryCodes: ["FR"] }],
    "POST /api/people": (call: FetchCall) => {
      const person = makePerson({ id: `new-${people.length}`, ...(call.body as Partial<Person>) });
      people = [...people, person];
      return jsonResponse(201, person);
    },
    "PATCH /api/people/sam": (call: FetchCall) => {
      people = people.map((p) => (p.id === "sam" ? { ...p, ...(call.body as Partial<Person>) } : p));
      return people.find((p) => p.id === "sam");
    },
    "DELETE /api/people/sam": () => {
      people = people.filter((p) => p.id !== "sam");
      return jsonResponse(204);
    },
    "POST /api/people/sam/claim": () => {
      people = people.filter((p) => p.id !== "me").map((p) => ({ ...p, isPrimary: p.id === "sam" }));
      return people[0];
    },
  }));
}

/**
 * The list row for one Person.
 * @param name - the Person's name.
 * @returns the row's <li>.
 */
async function rowFor(name: string): Promise<HTMLElement> {
  const nameEl = await screen.findByText(name, { selector: "span" });
  return nameEl.closest("li")!;
}

beforeEach(() => {
  people = [
    makePerson({ id: "me", name: "Alice", isPrimary: true }),
    makePerson({ id: "sam", name: "Sam", colorHex: "#00aa00" }),
  ];
});

describe("PeoplePage", () => {
  it("lists People with their state and country counts, marking You", async () => {
    fakeServer();
    render(<PeoplePage />);
    const alice = await rowFor("Alice");
    expect(within(alice).getByText("You")).toBeInTheDocument();
    expect(within(alice).getByText("2/50 states")).toBeInTheDocument();
    expect(within(alice).getByText("1/195 countries")).toBeInTheDocument();
    expect(within(await rowFor("Sam")).getByText("0/50 states")).toBeInTheDocument();
  });

  it("offers no Delete or Set as me for your own Person", async () => {
    fakeServer();
    render(<PeoplePage />);
    const alice = await rowFor("Alice");
    expect(within(alice).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(alice).queryByRole("button", { name: "Set as me" })).not.toBeInTheDocument();
    expect(within(await rowFor("Sam")).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows the empty state when there is no one", async () => {
    people = [];
    fakeServer();
    render(<PeoplePage />);
    expect(await screen.findByText(/No one added yet/)).toBeInTheDocument();
  });

  it("adds a Person with a name and a chosen color", async () => {
    fakeServer();
    render(<PeoplePage />);
    await rowFor("Alice");
    await userEvent.type(screen.getByPlaceholderText("e.g. Alice"), "  Zed ");
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#ff0000" } });
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(await rowFor("Zed")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ name: "Zed", colorHex: "#ff0000" });
    expect(screen.getByPlaceholderText("e.g. Alice")).toHaveValue("");
  });

  it("requires a name and a chosen color before sending anything", async () => {
    fakeServer();
    render(<PeoplePage />);
    await rowFor("Alice");
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Please choose a color.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("rejects a photo of the wrong type before sending anything", async () => {
    fakeServer();
    render(<PeoplePage />);
    await rowFor("Alice");
    await userEvent.type(screen.getByPlaceholderText("e.g. Alice"), "Zed");
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#ff0000" } });
    const gif = new File(["gif"], "a.gif", { type: "image/gif" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [gif] } });
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(screen.getByText("Photo must be JPEG, PNG, or WebP.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows the server's error when adding fails", async () => {
    fakeServer();
    render(<PeoplePage />);
    await rowFor("Alice");
    // Swap the create route for a refusal.
    mockFetch({
      "POST /api/people": jsonResponse(409, { error: "You can have up to 10 people, including yourself." }),
    });
    await userEvent.type(screen.getByPlaceholderText("e.g. Alice"), "Zed");
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#ff0000" } });
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(await screen.findByText("You can have up to 10 people, including yourself.")).toBeInTheDocument();
  });

  it("disables the form and explains why at the 10-People cap", async () => {
    fakeServer(10);
    render(<PeoplePage />);
    expect(await screen.findByText("You can have up to 10 people, including yourself.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add person" })).toBeDisabled();
  });

  it("renames a Person", async () => {
    fakeServer();
    render(<PeoplePage />);
    await userEvent.click(within(await rowFor("Sam")).getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByDisplayValue("Sam");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Samuel");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await rowFor("Samuel")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ name: "Samuel", colorHex: "#00aa00" });
  });

  it("won't save a blank name", async () => {
    fakeServer();
    render(<PeoplePage />);
    await userEvent.click(within(await rowFor("Sam")).getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByDisplayValue("Sam"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Name cannot be empty.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("deletes a Person only after the confirmation", async () => {
    fakeServer();
    render(<PeoplePage />);
    await userEvent.click(within(await rowFor("Sam")).getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Their visited states and countries will also be removed/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(screen.queryByText("Sam", { selector: "span" })).not.toBeInTheDocument());
  });

  it("cancelling the delete keeps the Person", async () => {
    fakeServer();
    render(<PeoplePage />);
    await userEvent.click(within(await rowFor("Sam")).getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await rowFor("Sam")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("Set as me explains the merge, then makes that Person You", async () => {
    fakeServer();
    render(<PeoplePage />);
    await userEvent.click(within(await rowFor("Sam")).getByRole("button", { name: "Set as me" }));
    expect(screen.getByText(/"Alice" \(currently you\) will be merged in/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Set as me" }));
    expect(await within(await rowFor("Sam")).findByText("You")).toBeInTheDocument();
    expect(screen.queryByText("Alice", { selector: "span" })).not.toBeInTheDocument();
  });

  it("shows a load error", async () => {
    mockFetch({ "GET /api/people": jsonResponse(500, { error: "Database is down" }) });
    render(<PeoplePage />);
    expect(await screen.findByText("Database is down")).toBeInTheDocument();
  });
});
