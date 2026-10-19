import { useState } from "react";
import { Link } from "react-router-dom";
import type { SignedInUser } from "@familypassportmap/shared";
import { signOut } from "../api/auth";

/**
 * The signed-in User's avatar (and name, on wide screens), opening a small menu with their
 * name and email, the privacy page, and Sign out.
 * @param user - the signed-in User.
 */
export function UserMenu({ user }: { user: SignedInUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  /**
   * Ends the session, then reloads onto the sign-in page so no data stays in memory. If the
   * server can't be reached, stays put and says so — the session may still be live.
   */
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      window.location.assign("/signin");
    } catch {
      setSigningOut(false);
      setSignOutError("Couldn't sign out. Check your connection and try again.");
    }
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
          {/* The name is hidden next to the avatar on phones, so the menu always shows it. */}
          <div className="px-3 py-2">
            <p className="text-sm text-[var(--color-text-heading)] truncate">{user.displayName}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
          </div>
          <Link
            to="/privacy"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-[var(--color-bg-card)]"
          >
            Privacy
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-card)] disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {/* Only after a failed sign-out attempt. */}
          {signOutError && (
            <p role="alert" className="px-3 py-2 text-xs text-[var(--color-danger)]">
              {signOutError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
