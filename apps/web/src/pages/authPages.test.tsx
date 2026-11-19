import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { jsonResponse, makePerson, mockFetch } from "../test/api";

vi.mock("../navigation", () => ({ loadPage: vi.fn() }));
const { loadPage } = await import("../navigation");
const { WelcomePage } = await import("./WelcomePage");
const { SignInPage } = await import("./SignInPage");
const { PrivacyPage } = await import("./PrivacyPage");

beforeEach(() => {
  vi.mocked(loadPage).mockClear();
});

describe("WelcomePage", () => {
  it("prefills the name from the Microsoft account", () => {
    render(<WelcomePage suggestedName="Alice Smith" />);
    expect(screen.getByLabelText("Your name")).toHaveValue("Alice Smith");
  });

  it("needs a name and a chosen color before saving", async () => {
    const { calls } = mockFetch({});
    render(<WelcomePage suggestedName="" />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Please choose a color.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("creates the Primary Person, then loads the US map", async () => {
    const { calls } = mockFetch({ "POST /api/me/primary-person": jsonResponse(201, makePerson({ isPrimary: true })) });
    render(<WelcomePage suggestedName=" Alice " />);
    fireEvent.change(screen.getByLabelText("Your color"), { target: { value: "#ff8800" } });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/us/map"));
    expect(calls[0].body).toEqual({ name: "Alice", colorHex: "#ff8800" });
  });

  it("still continues when welcome was already finished in another tab (409)", async () => {
    mockFetch({ "POST /api/me/primary-person": jsonResponse(409, { error: "You already have a Primary Person." }) });
    render(<WelcomePage suggestedName="Alice" />);
    fireEvent.change(screen.getByLabelText("Your color"), { target: { value: "#ff8800" } });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/us/map"));
  });

  it("shows the server's error and stays on the form", async () => {
    mockFetch({ "POST /api/me/primary-person": jsonResponse(400, { error: "Must be a hex color like #3366CC" }) });
    render(<WelcomePage suggestedName="Alice" />);
    fireEvent.change(screen.getByLabelText("Your color"), { target: { value: "#ff8800" } });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Must be a hex color like #3366CC");
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("can sign out from the welcome step", async () => {
    mockFetch({ "POST /api/auth/signout": jsonResponse(204) });
    render(<WelcomePage suggestedName="Alice" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/signin"));
  });
});

describe("SignInPage", () => {
  /**
   * Renders the sign-in page at a URL.
   * @param url - the /signin URL, with any query.
   */
  function renderAt(url: string) {
    render(
      <MemoryRouter initialEntries={[url]}>
        <SignInPage />
      </MemoryRouter>,
    );
  }

  it("starts Microsoft sign-in, coming back to the requested page", () => {
    renderAt("/signin?returnTo=%2Fworld%2Flist");
    expect(screen.getByRole("link", { name: "Sign in with Microsoft" })).toHaveAttribute(
      "href",
      "/api/auth/microsoft?returnTo=%2Fworld%2Flist",
    );
  });

  it("comes back to the US map when no page was requested", () => {
    renderAt("/signin");
    expect(screen.getByRole("link", { name: "Sign in with Microsoft" })).toHaveAttribute(
      "href",
      "/api/auth/microsoft?returnTo=%2Fus%2Fmap",
    );
  });

  it("explains a cancelled or failed sign-in", () => {
    renderAt("/signin?error=cancelled");
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in was cancelled.");
  });

  it("gives the generic message for an unknown error code", () => {
    renderAt("/signin?error=something-else");
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't work. Please try again.");
  });

  it("shows no error normally, and links to Privacy", () => {
    renderAt("/signin");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });
});

describe("PrivacyPage", () => {
  it("covers what's stored, who sees it, photos, signing in and deleting", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "What we store",
      "Who can see it",
      "Photos",
      "Signing in",
      "Deleting your data",
    ]);
  });
});
