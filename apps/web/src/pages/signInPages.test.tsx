import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { jsonResponse, mockFetch } from "../test/api";

// The sign-in page and the Sign-in methods page. Full page loads, passkey support and the browser's
// passkey prompt are replaced: jsdom has none of them.

vi.mock("../navigation", () => ({ loadPage: vi.fn() }));
vi.mock("../passkeySupport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../passkeySupport")>()),
  canUsePasskeys: vi.fn(() => true),
}));
vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(async () => ({ id: "cred" })),
  startRegistration: vi.fn(async () => ({ id: "new-cred" })),
  browserSupportsWebAuthn: () => true,
}));

const { loadPage } = await import("../navigation");
const { canUsePasskeys } = await import("../passkeySupport");
const { startAuthentication } = await import("@simplewebauthn/browser");
const { SignInPage } = await import("./SignInPage");
const { SignInMethodsPage } = await import("./SignInMethodsPage");

const ALL_METHODS = { providers: ["microsoft", "google", "github"], passkeys: true };

beforeEach(() => {
  vi.mocked(loadPage).mockClear();
  vi.mocked(canUsePasskeys).mockReturnValue(true);
});

/**
 * Renders a page at a URL inside a router.
 * @param page - the page element.
 * @param url - the starting URL.
 */
function renderAt(page: React.ReactElement, url: string) {
  render(<MemoryRouter initialEntries={[url]}>{page}</MemoryRouter>);
}

describe("SignInPage", () => {
  it("shows a button for each provider the server has, coming back to the requested page", async () => {
    mockFetch({ "GET /api/auth/methods": ALL_METHODS });
    renderAt(<SignInPage />, "/signin?returnTo=%2Fworld%2Flist");
    expect(await screen.findByRole("link", { name: "Continue with Microsoft" })).toHaveAttribute("href", "/api/auth/microsoft?returnTo=%2Fworld%2Flist");
    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/auth/google?returnTo=%2Fworld%2Flist");
    expect(screen.getByRole("link", { name: "Continue with GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with a passkey" })).toBeInTheDocument();
  });

  it("shows only the providers that are set up, and no email field", async () => {
    mockFetch({ "GET /api/auth/methods": { providers: ["google"], passkeys: true } });
    renderAt(<SignInPage />, "/signin");
    expect(await screen.findByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/auth/google?returnTo=%2Fus%2Fmap");
    expect(screen.queryByRole("link", { name: "Continue with Microsoft" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("hides passkeys when the browser or page can't use them", async () => {
    vi.mocked(canUsePasskeys).mockReturnValue(false);
    mockFetch({ "GET /api/auth/methods": ALL_METHODS });
    renderAt(<SignInPage />, "/signin");
    await screen.findByRole("link", { name: "Continue with Microsoft" });
    expect(screen.queryByRole("button", { name: "Sign in with a passkey" })).not.toBeInTheDocument();
  });

  it("signs in with a passkey", async () => {
    const { calls } = mockFetch({
      "GET /api/auth/methods": ALL_METHODS,
      "POST /api/auth/passkey/signin/options": { challenge: "c" },
      "POST /api/auth/passkey/signin/verify": { redirectTo: "/world/map" },
    });
    renderAt(<SignInPage />, "/signin?returnTo=%2Fworld%2Fmap");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in with a passkey" }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/world/map"));
    expect(calls.at(-1)?.body).toEqual({ response: { id: "cred" }, returnTo: "/world/map" });
  });

  it("says so when the passkey prompt is closed", async () => {
    vi.mocked(startAuthentication).mockRejectedValueOnce(Object.assign(new Error("closed"), { name: "NotAllowedError" }));
    mockFetch({ "GET /api/auth/methods": ALL_METHODS, "POST /api/auth/passkey/signin/options": { challenge: "c" } });
    renderAt(<SignInPage />, "/signin");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in with a passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The passkey prompt was closed.");
  });

  it("creates an account with a new passkey", async () => {
    mockFetch({
      "GET /api/auth/methods": ALL_METHODS,
      "POST /api/auth/passkey/register/options": { challenge: "c" },
      "POST /api/auth/passkey/register/verify": { redirectTo: "/welcome" },
    });
    renderAt(<SignInPage />, "/signin");
    await userEvent.click(await screen.findByRole("button", { name: "New here? Create an account with a passkey" }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/welcome"));
  });

  it.each([
    ["cancelled", "Sign-in was cancelled."],
    ["taken", "That sign-in already belongs to another account."],
    ["something-else", "Sign-in didn't work. Please try again."],
  ])("explains error=%s", async (code, message) => {
    mockFetch({ "GET /api/auth/methods": ALL_METHODS });
    renderAt(<SignInPage />, `/signin?error=${code}`);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("links to Privacy, and says so if the options can't load", async () => {
    mockFetch({ "GET /api/auth/methods": jsonResponse(500) });
    renderAt(<SignInPage />, "/signin");
    expect(await screen.findByText(/Couldn't load the sign-in options/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });
});

describe("SignInMethodsPage", () => {
  const microsoft = { id: "m1", kind: "microsoft", label: "alice@example.com", createdAt: "2026-01-02T00:00:00.000Z", lastUsedAt: "2026-03-04T00:00:00.000Z" };
  const passkey = { id: "p1", kind: "passkey", label: "Phone", createdAt: "2026-02-01T00:00:00.000Z", lastUsedAt: "2026-02-01T00:00:00.000Z" };

  /**
   * The list row for a method's label.
   * @param label - the label text.
   * @returns the row.
   */
  function rowFor(label: string) {
    return screen.getByText(label, { exact: false }).closest("li")!;
  }

  it("lists each method with its kind and dates, and offers to add each kind", async () => {
    mockFetch({ "GET /api/me/sign-in-methods": { methods: [microsoft, passkey] }, "GET /api/auth/methods": ALL_METHODS });
    renderAt(<SignInMethodsPage />, "/account/sign-in");
    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(rowFor("alice@example.com")).toHaveTextContent("Microsoft:");
    expect(rowFor("alice@example.com")).toHaveTextContent(/Added .*2026.* Last used/);
    expect(screen.getByRole("link", { name: "Add Google" })).toHaveAttribute("href", "/api/auth/google?returnTo=%2Faccount%2Fsign-in&intent=add");
    expect(screen.getByRole("button", { name: "Add passkey" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("removes a method and reloads the list", async () => {
    let methods = [microsoft, passkey];
    const { calls } = mockFetch({
      "GET /api/me/sign-in-methods": () => ({ methods }),
      "DELETE /api/me/sign-in-methods/m1": () => {
        methods = [passkey];
        return jsonResponse(204);
      },
      "GET /api/auth/methods": ALL_METHODS,
    });
    renderAt(<SignInMethodsPage />, "/account/sign-in");
    await screen.findByText("alice@example.com");
    await userEvent.click(within(rowFor("alice@example.com")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument());
    expect(calls.some((call) => call.method === "DELETE")).toBe(true);
  });

  it("won't offer to remove the last method, and says why", async () => {
    mockFetch({ "GET /api/me/sign-in-methods": { methods: [microsoft] }, "GET /api/auth/methods": ALL_METHODS });
    renderAt(<SignInMethodsPage />, "/account/sign-in");
    await screen.findByText("alice@example.com");
    expect(within(rowFor("alice@example.com")).getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByText(/This is your only way to sign in/)).toBeInTheDocument();
  });

  it("renames a passkey", async () => {
    let methods = [microsoft, passkey];
    const { calls } = mockFetch({
      "GET /api/me/sign-in-methods": () => ({ methods }),
      "PATCH /api/me/passkeys/p1": () => {
        methods = [microsoft, { ...passkey, label: "Tablet" }];
        return { ...passkey, label: "Tablet" };
      },
      "GET /api/auth/methods": ALL_METHODS,
    });
    renderAt(<SignInMethodsPage />, "/account/sign-in");
    await screen.findByText("Phone");
    // Only the passkey has Rename.
    expect(within(rowFor("alice@example.com")).queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    await userEvent.click(within(rowFor("Phone")).getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Passkey name", { selector: "input[id^=rename]" });
    await userEvent.clear(input);
    await userEvent.type(input, "Tablet");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Tablet")).toBeInTheDocument();
    expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({ name: "Tablet" });
  });

  it("adds a named passkey", async () => {
    const { calls } = mockFetch({
      "GET /api/me/sign-in-methods": { methods: [microsoft] },
      "GET /api/auth/methods": ALL_METHODS,
      "POST /api/auth/passkey/register/options": { challenge: "c" },
      "POST /api/auth/passkey/register/verify": jsonResponse(204),
    });
    renderAt(<SignInMethodsPage />, "/account/sign-in");
    await userEvent.type(await screen.findByPlaceholderText("e.g. Bob's iPhone"), "My laptop");
    await userEvent.click(screen.getByRole("button", { name: "Add passkey" }));
    await waitFor(() => expect(calls.find((call) => call.url === "/api/auth/passkey/register/verify")?.body).toEqual({ response: { id: "new-cred" }, name: "My laptop" }));
  });

  it("explains a provider add that came back taken", async () => {
    mockFetch({ "GET /api/me/sign-in-methods": { methods: [microsoft] }, "GET /api/auth/methods": ALL_METHODS });
    renderAt(<SignInMethodsPage />, "/account/sign-in?error=taken");
    expect(await screen.findByRole("alert")).toHaveTextContent("That sign-in already belongs to another account.");
  });
});
