import { useState } from "react";
import { Link } from "react-router-dom";
import { userLabel, type SignedInUser } from "@familypassportmap/shared";
import { signOut } from "../api/auth";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { loadPage } from "../navigation";
import { isDemo } from "../demoMode";

/**
 * The signed-in User's avatar (and name, on wide screens), opening a small menu with their
 * name and email, Sign-in methods, the privacy page, Sign out, and Delete account. In the guest demo there's no
 * account, so the menu has only the Guest's name and Privacy.
 * @param user - the signed-in User.
 */
export function UserMenu({ user }: { user: SignedInUser }) {
  const demo = isDemo();
  // Passkey accounts may have no name (yet): fall back to the email, then "New user".
  const label = userLabel(user);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /**
   * Ends the session, then reloads onto the sign-in page so no data stays in memory. If the
   * server can't be reached, stays put and says so — the session may still be live.
   */
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      loadPage("/signin");
    } catch {
      setSigningOut(false);
      setSignOutError("Couldn't sign out. Check your connection and try again.");
    }
  }

  /** Closes the menu and opens the Delete account confirmation in its place. */
  function handleDeleteAccountClick() {
    setOpen(false);
    setConfirmingDelete(true);
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
        {/* The last provider's picture when there is one (Google, GitHub; Microsoft sends none); otherwise the first letter. */}
        {user.avatarUrl ? (
          // no-referrer: avatar hosts can refuse images requested with a Referer.
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-primary)] text-white text-sm font-medium">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden md:inline text-sm text-[var(--color-text-heading)]">{label}</span>
      </button>

      {/* The menu itself, only while open. */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg z-50"
        >
          {/* The name is hidden next to the avatar on phones, so the menu always shows it. */}
          <div className="px-3 py-2">
            <p className="text-sm text-[var(--color-text-heading)] truncate">{label}</p>
            {/* The demo's Guest has no email address to show, and neither does a passkey-only account. */}
            {!demo && user.email && user.email !== label && (
              <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
            )}
          </div>
          {/* Managing sign-in methods needs a real account. */}
          {!demo && (
            <Link
              to="/account/sign-in"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm hover:bg-[var(--color-bg-card)]"
            >
              Sign-in methods
            </Link>
          )}
          <Link
            to="/privacy"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-[var(--color-bg-card)]"
          >
            Privacy
          </Link>
          {/* Sign out and Delete account need a real account, so the demo leaves them out. */}
          {!demo && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-card)] disabled:opacity-50"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleDeleteAccountClick}
                className="w-full text-left px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-bg-card)]"
              >
                Delete account
              </button>
            </>
          )}
          {/* Only after a failed sign-out attempt. */}
          {signOutError && (
            <p role="alert" className="px-3 py-2 text-xs text-[var(--color-danger)]">
              {signOutError}
            </p>
          )}
        </div>
      )}

      {/* The confirmation, opened from the menu's Delete account item. */}
      {confirmingDelete && <DeleteAccountDialog onClose={() => setConfirmingDelete(false)} />}
    </div>
  );
}
