import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PROVIDERS } from "@familypassportmap/shared";
import { PasskeyButton, ProviderButton } from "./SignInButtons";

describe("ProviderButton", () => {
  it("is a link named only by its text, with the provider's logo hidden from screen readers", () => {
    // Every provider: the logo mustn't add words like "Google logo" to the link's name.
    for (const provider of PROVIDERS) {
      const { container, unmount } = render(
        <ProviderButton provider={provider} href={`/api/auth/${provider}`}>
          Continue with {provider}
        </ProviderButton>,
      );
      const link = screen.getByRole("link", { name: `Continue with ${provider}` });
      expect(link).toHaveAttribute("href", `/api/auth/${provider}`);
      expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
      unmount();
    }
  });

  it("gives each provider its own colors", () => {
    // Rendered one at a time; the class lists must all differ.
    const classes = PROVIDERS.map((provider) => {
      const { unmount } = render(
        <ProviderButton provider={provider} href="#">
          x
        </ProviderButton>,
      );
      const className = screen.getByRole("link").className;
      unmount();
      return className;
    });
    expect(new Set(classes).size).toBe(PROVIDERS.length);
  });

  it("shows Google's G with a dark-mode copy", () => {
    const { container } = render(
      <ProviderButton provider="google" href="#">
        Continue with Google
      </ProviderButton>,
    );
    expect(container.querySelector("source[media='(prefers-color-scheme: dark)']")).not.toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});

describe("PasskeyButton", () => {
  it("is a button named by its text that runs its click handler", async () => {
    const onClick = vi.fn();
    render(<PasskeyButton onClick={onClick}>Sign in with a passkey</PasskeyButton>);
    const button = screen.getByRole("button", { name: "Sign in with a passkey" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", async () => {
    const onClick = vi.fn();
    render(
      <PasskeyButton disabled onClick={onClick}>
        Sign in with a passkey
      </PasskeyButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
