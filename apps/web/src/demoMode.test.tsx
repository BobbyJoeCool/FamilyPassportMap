import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { makePerson, mockFetch } from "./test/api";
import { isDemo, REPO_URL, routerBasename } from "./demoMode";
import { UserMenu } from "./components/UserMenu";
import { PrivacyPage } from "./pages/PrivacyPage";
import App from "./App";

// The guest demo's UI differences, switched on with the build flag. The fake API is tested in
// src/demo; here the app gets a plain faked fetch like the other page tests.

const guest = { id: "demo-guest", email: "", displayName: "Guest", avatarUrl: null };

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Shows the router's current path, so tests can see where a redirect landed. */
function CurrentPath() {
  const location = useLocation();
  return <output data-testid="path">{location.pathname}</output>;
}

/**
 * Renders the whole app at a URL with the Guest signed in and one Person.
 * @param url - the starting URL.
 */
function renderApp(url: string) {
  mockFetch({
    "GET /api/me": { user: guest, primaryPersonId: "p1" },
    "GET /api/people": [makePerson({ id: "p1", isPrimary: true })],
    "GET /api/people/allowance": { owned: 1, max: 10 },
    "GET /api/people/p1/visits": [],
    "GET /api/visits": [],
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  );
}

describe("demo build flag", () => {
  it("is off unless VITE_DEMO is exactly 'true'", () => {
    expect(isDemo()).toBe(false);
    vi.stubEnv("VITE_DEMO", "false");
    expect(isDemo()).toBe(false);
    vi.stubEnv("VITE_DEMO", "true");
    expect(isDemo()).toBe(true);
  });

  it.each([
    ["/", "/"],
    ["/FamilyPassportMap/", "/FamilyPassportMap"],
    ["/a/b/", "/a/b"],
  ])("turns base %s into router basename %s", (base, basename) => {
    expect(routerBasename(base)).toBe(basename);
  });
});

describe("App in the demo", () => {
  it.each(["/signin", "/welcome"])("sends %s straight to the US map", async (url) => {
    vi.stubEnv("VITE_DEMO", "true");
    renderApp(url);
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/us/map"));
    expect(screen.queryByRole("link", { name: /Sign in/ })).not.toBeInTheDocument();
  });

  it("shows the banner, linking to the repo, on every page", async () => {
    vi.stubEnv("VITE_DEMO", "true");
    renderApp("/people");
    const banner = await screen.findByRole("note", { name: "Demo notice" });
    expect(banner).toHaveTextContent("Demo: changes aren't saved, and reloading starts over.");
    expect(screen.getByRole("link", { name: "See the code on GitHub" })).toHaveAttribute("href", REPO_URL);
    // Nothing to dismiss it with.
    expect(banner.querySelector("button")).toBeNull();
  });

  it("shows no banner in the normal app", async () => {
    renderApp("/people");
    expect(await screen.findByRole("heading", { name: /People/ })).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "Demo notice" })).not.toBeInTheDocument();
  });
});

describe("account menu in the demo", () => {
  it("has only the Guest's name and Privacy", async () => {
    vi.stubEnv("VITE_DEMO", "true");
    render(
      <MemoryRouter>
        <UserMenu user={guest} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Guest/ }));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Privacy"]);
    expect(screen.getByRole("menu")).toHaveTextContent("Guest");
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete account")).not.toBeInTheDocument();
  });
});

describe("privacy page in the demo", () => {
  it("says nothing leaves the browser, instead of the real app's notice", () => {
    vi.stubEnv("VITE_DEMO", "true");
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: "This is the guest demo" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing you type or upload leaves it/)).toBeInTheDocument();
    expect(screen.queryByText(/Microsoft/)).not.toBeInTheDocument();
  });

  it("keeps the real notice in the normal app", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: "What we store" })).toBeInTheDocument();
  });
});
