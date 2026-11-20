import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { SignedInUser } from "@familypassportmap/shared";
import { jsonResponse, mockFetch } from "../test/api";

vi.mock("../navigation", () => ({ loadPage: vi.fn() }));
const { loadPage } = await import("../navigation");
const { UserMenu } = await import("./UserMenu");
const { DeleteAccountDialog } = await import("./DeleteAccountDialog");

const user = { id: "u1", email: "alice@example.com", displayName: "Alice Smith", avatarUrl: null };

beforeEach(() => {
  vi.mocked(loadPage).mockClear();
});

/** Renders the user menu inside a router (it links to /privacy). */
function renderMenu() {
  render(
    <MemoryRouter>
      <UserMenu user={user} />
    </MemoryRouter>,
  );
}

describe("UserMenu", () => {
  it("shows the first letter and name, with the menu closed", () => {
    renderMenu();
    const toggle = screen.getByRole("button", { name: /Alice Smith/ });
    expect(toggle).toHaveTextContent("A");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens to show the name, email, Privacy, Sign out and Delete account", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /Alice Smith/ }));
    const menu = screen.getByRole("menu");
    expect(menu).toHaveTextContent("alice@example.com");
    expect(screen.getByRole("menuitem", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete account" })).toBeInTheDocument();
  });

  it("signs out, then reloads onto the sign-in page", async () => {
    const { calls } = mockFetch({ "POST /api/auth/signout": jsonResponse(204) });
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /Alice Smith/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/signin"));
    expect(calls).toHaveLength(1);
  });

  it("stays put and says so when sign-out fails", async () => {
    mockFetch({ "POST /api/auth/signout": jsonResponse(500) });
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /Alice Smith/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't sign out");
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("opens the delete confirmation from Delete account, closing the menu", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /Alice Smith/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete account" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete your account?" })).toBeInTheDocument();
  });
});

describe("DeleteAccountDialog", () => {
  it("opens as a modal listing everything that will be deleted", () => {
    render(<DeleteAccountDialog onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Delete your account?" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveTextContent("all your People");
    expect(dialog).toHaveTextContent("This can't be undone.");
  });

  it("Cancel closes without calling the API", async () => {
    const { calls } = mockFetch({});
    const onClose = vi.fn();
    render(<DeleteAccountDialog onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("Escape closes without calling the API", async () => {
    const { calls } = mockFetch({});
    const onClose = vi.fn();
    render(<DeleteAccountDialog onClose={onClose} />);
    screen.getByRole("dialog").dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("deletes the account, then reloads onto the sign-in page", async () => {
    const { calls } = mockFetch({ "DELETE /api/me": jsonResponse(204) });
    render(<DeleteAccountDialog onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/signin"));
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "/api/me" });
  });

  it("disables both buttons while deleting, and Escape can't cancel then", async () => {
    let finish: (res: Response) => void = () => {};
    mockFetch({ "DELETE /api/me": () => new Promise<Response>((resolve) => (finish = resolve)) });
    const onClose = vi.fn();
    render(<DeleteAccountDialog onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    screen.getByRole("dialog").dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    finish(jsonResponse(204));
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/signin"));
  });

  it("stays open with an error when the delete fails", async () => {
    mockFetch({ "DELETE /api/me": jsonResponse(500) });
    render(<DeleteAccountDialog onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't delete your account");
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeEnabled();
    expect(loadPage).not.toHaveBeenCalled();
  });
});

describe("UserMenu (Phase 13)", () => {
  /**
   * Renders the menu for a given User and opens it.
   * @param overrides - fields to change on the default test User.
   */
  async function openMenuFor(overrides: Partial<SignedInUser>) {
    render(
      <MemoryRouter>
        <UserMenu user={{ ...user, ...overrides }} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button"));
  }

  it("links to Sign-in methods", async () => {
    await openMenuFor({});
    expect(screen.getByRole("menuitem", { name: "Sign-in methods" })).toHaveAttribute("href", "/account/sign-in");
  });

  it("shows the email as the name for an account with no name yet, without repeating it", async () => {
    await openMenuFor({ displayName: "", email: "ann@mail.test" });
    expect(screen.getByRole("button", { name: /ann@mail.test/ })).toHaveTextContent("A");
    expect(screen.getByRole("menu").textContent?.match(/ann@mail\.test/g)).toHaveLength(1);
  });

  it("shows 'New user' for a passkey account with no name or email", async () => {
    await openMenuFor({ displayName: "", email: null });
    expect(screen.getByRole("menu")).toHaveTextContent("New user");
  });

  it("shows the provider's picture when there is one", () => {
    render(
      <MemoryRouter>
        <UserMenu user={{ ...user, avatarUrl: "https://avatars.test/a.png" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button").querySelector("img")).toHaveAttribute("src", "https://avatars.test/a.png");
  });
});
