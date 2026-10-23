import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { deleteAccount } from "../api/auth";

/**
 * The "Delete account" confirmation: a modal that spells out everything that will be
 * permanently deleted before anything happens. Confirming deletes the account, then reloads
 * onto the sign-in page so nothing from this User stays in memory. Cancelling (the Cancel
 * button or Escape) changes nothing.
 * @param onClose - called when the User cancels.
 */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open as a true modal (focus trapped, page behind inert) as soon as it's rendered.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  /**
   * Deletes the account, then leaves the app for the sign-in page. If the server can't be
   * reached, stays open and says so — the account may still exist.
   */
  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      window.location.assign("/signin");
    } catch {
      setDeleting(false);
      setError("Couldn't delete your account. Check your connection and try again.");
    }
  }

  /**
   * Escape closes the dialog natively; route that through onClose so the parent unmounts it
   * — unless a delete is already under way, which can't be cancelled.
   * @param event - the dialog's cancel event.
   */
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    // Mid-delete there's nothing to cancel; otherwise Escape is the same as Cancel.
    if (!deleting) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      aria-labelledby="delete-account-title"
      className="m-auto w-[min(28rem,calc(100%-2rem))] p-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] backdrop:bg-black/50"
    >
      <h2 id="delete-account-title" className="text-lg font-semibold text-[var(--color-text-heading)]">
        Delete your account?
      </h2>
      <p className="mt-2 text-sm">This permanently deletes:</p>
      <ul className="mt-1 ml-5 list-disc text-sm">
        <li>your account</li>
        <li>all your People</li>
        <li>their visited states and countries</li>
        <li>their photos</li>
      </ul>
      <p className="mt-2 text-sm">This can't be undone.</p>

      {/* Only after a failed attempt. */}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="px-3 py-1 rounded border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-card)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1 rounded bg-[var(--color-danger)] text-white text-sm hover:bg-[var(--color-danger-hover)] transition-colors disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </dialog>
  );
}
