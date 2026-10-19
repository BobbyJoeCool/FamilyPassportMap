import { useState } from "react";
import type { SignedInUser } from "@familypassportmap/shared";
import { signOut } from "../api/auth";

/**
 * The signed-in User's avatar and name, opening a small menu with Sign out.
 * @param user - the signed-in User.
 */
export function AccountMenu({ user }: { user: SignedInUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /** Ends the session, then reloads onto the sign-in page so no data stays in memory. */
  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    window.location.assign("/signin");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--color-bg-card)] transition-colors"
      >
        {/* Google's picture when there is one; otherwise the first letter of the name. */}
        {user.avatarUrl ? (
          // no-referrer: Google's avatar host can refuse images requested with a Referer.
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
        ) : (
          <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-primary)] text-white text-sm font-medium">
            {user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden md:inline text-sm text-[var(--color-text-heading)]">{user.displayName}</span>
      </button>

      {/* The menu itself, only while open. */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg z-50"
        >
          <p className="px-3 py-2 text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-card)] disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
