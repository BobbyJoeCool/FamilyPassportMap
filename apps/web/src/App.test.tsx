import { describe, it, expect } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SECTION_TABS } from "./sections";
import { jsonResponse, makePerson, mockFetch } from "./test/api";
import App from "./App";

const signedIn = {
  user: { id: "u1", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
  primaryPersonId: "p1",
};

/** Shows the router's current path, so tests can see where a redirect landed. */
function CurrentPath() {
  const location = useLocation();
  return <output data-testid="path">{location.pathname + location.search}</output>;
}

/**
 * Waits until the router has settled on a path (redirects happen after the first render).
 * @param path - the expected path and query.
 */
async function expectPath(path: string) {
  await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent(path));
}

/**
 * Renders the whole app at a URL, with the API answering /api/me as given and one Person with
 * no visits, so every page renders its full layout.
 * @param url - the starting URL.
 * @param me - what GET /api/me answers.
 */
function renderApp(url: string, me: unknown) {
  mockFetch({
    "GET /api/me": me,
    "GET /api/auth/methods": { providers: ["microsoft"], passkeys: true },
    "GET /api/people": [makePerson({ id: "p1", isPrimary: true })],
    "GET /api/people/allowance": { owned: 1, max: 10 },
    "GET /api/people/p1/visits": [],
    "GET /api/people/p1/countries": [],
    "GET /api/visits": [],
    "GET /api/countries": [],
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  );
}

describe("App sign-in gate", () => {
  it("sends a signed-out visitor to sign-in, remembering the page", async () => {
    renderApp("/world/list", jsonResponse(401));
    expect(await screen.findByRole("link", { name: "Continue with Microsoft" })).toBeInTheDocument();
    await expectPath("/signin?returnTo=%2Fworld%2Flist");
  });

  it("shows the privacy page to a signed-out visitor", async () => {
    renderApp("/privacy", jsonResponse(401));
    expect(await screen.findByRole("heading", { name: "Privacy" })).toBeInTheDocument();
  });

  it("says the server couldn't be reached instead of pretending to be signed out", async () => {
    renderApp("/us/map", jsonResponse(500));
    expect(await screen.findByText(/Couldn't reach the server/)).toBeInTheDocument();
  });

  it("sends a signed-in User away from /signin to the return path", async () => {
    renderApp("/signin?returnTo=%2Fpeople", signedIn);
    expect(await screen.findByRole("heading", { name: "People" })).toBeInTheDocument();
    await expectPath("/people");
  });

  it("ignores an off-site return path after sign-in", async () => {
    renderApp("/signin?returnTo=%2F%2Fevil.example", signedIn);
    await expectPath("/us/map");
  });

  it("puts a User with no Primary Person on the welcome step first", async () => {
    renderApp("/world/map", { ...signedIn, primaryPersonId: null });
    expect(await screen.findByRole("heading", { name: "Welcome!" })).toBeInTheDocument();
    await expectPath("/welcome");
  });

  it("sends a welcomed User from /welcome to the US map", async () => {
    renderApp("/welcome", signedIn);
    expect(await screen.findByRole("heading", { name: "US Map" })).toBeInTheDocument();
  });
});

describe("App routes", () => {
  it("lands on the US map at /", async () => {
    renderApp("/", signedIn);
    await expectPath("/us/map");
  });

  it("has a page behind every section tab", async () => {
    // Each section × tab must render its own page heading (the World pages load lazily).
    for (const [section, title] of [
      ["us", "US"],
      ["world", "World"],
    ] as const) {
      for (const tab of SECTION_TABS) {
        renderApp(`/${section}/${tab.path}`, signedIn);
        expect(await screen.findByRole("heading", { level: 1, name: `${title} ${tab.label}` })).toBeInTheDocument();
        cleanup();
      }
    }
  });

  it("redirects the old /map, /compare and /list paths into /us/", async () => {
    renderApp("/compare", signedIn);
    expect(await screen.findByRole("heading", { name: "US Compare" })).toBeInTheDocument();
  });

  it("keeps the current tab when switching between US and World", async () => {
    renderApp("/us/list", signedIn);
    await screen.findByRole("heading", { name: "US List" });
    const nav = screen.getAllByRole("navigation")[0];
    expect(within(nav).getByRole("link", { name: /World/ })).toHaveAttribute("href", "/world/list");
    expect(within(nav).getByRole("link", { name: /People/ })).toHaveAttribute("href", "/people");
  });

  it("shows the user menu in the signed-in shell", async () => {
    renderApp("/people", signedIn);
    expect((await screen.findAllByRole("button", { name: /Alice/ })).length).toBeGreaterThan(0);
  });
});
