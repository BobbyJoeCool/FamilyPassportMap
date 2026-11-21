import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_PASSKEY_NAME,
  PROVIDER_LABELS,
  SIGN_IN_ERRORS,
  TAKEN_MESSAGE,
  type AvailableSignInMethods,
  type SignInError,
  type SignInMethodKind,
  type SignInMethodSummary,
} from "@familypassportmap/shared";
import {
  createPasskey,
  fetchAvailableSignInMethods,
  listSignInMethods,
  providerSignInUrl,
  removeSignInMethod,
  renamePasskey,
} from "../api/auth";
import { PasskeyIcon, ProviderButton } from "../components/SignInButtons";
import { canUsePasskeys, passkeyErrorMessage } from "../passkeySupport";

/** Where adding a method came back with an error (the `error` query value). */
const ADD_ERRORS: Record<SignInError, string> = {
  cancelled: "Adding that sign-in was cancelled.",
  failed: "Adding that sign-in didn't work. Please try again.",
  taken: TAKEN_MESSAGE,
};

/** How each kind of method is named in the list. */
const KIND_LABELS: Record<SignInMethodKind, string> = { ...PROVIDER_LABELS, passkey: "Passkey" };

/**
 * A date for the list, e.g. "Nov 20, 2026".
 * @param iso - an ISO timestamp.
 * @returns the formatted date.
 */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The Sign-in methods page (`/account/sign-in`, from the account menu): every way the User can sign
 * in, with remove (never the last one) and rename for passkeys, plus adding a provider account or a
 * passkey.
 */
export function SignInMethodsPage() {
  const [params, setParams] = useSearchParams();
  const [methods, setMethods] = useState<SignInMethodSummary[] | null>(null);
  const [available, setAvailable] = useState<AvailableSignInMethods | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [busy, setBusy] = useState(false);

  // A provider round trip that failed comes back with ?error=.
  const returnedError = params.get("error");
  const addError = returnedError === null ? null : ADD_ERRORS[SIGN_IN_ERRORS.find((known) => known === returnedError) ?? "failed"];

  /** Reloads the list from the server after a change. */
  const refresh = useCallback(async () => {
    try {
      setMethods(await listSignInMethods());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your sign-in methods.");
    }
  }, []);

  useEffect(() => {
    // First load: state is set only when each answer arrives.
    listSignInMethods()
      .then(setMethods)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load your sign-in methods."));
    fetchAvailableSignInMethods()
      .then(setAvailable)
      .catch(() => setAvailable({ providers: [], passkeys: false }));
  }, []);

  /**
   * Runs one change, then reloads the list; shows the server's message if it fails.
   * @param action - the change.
   */
  async function change(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    // A new action replaces any message left over from a provider round trip.
    if (returnedError) setParams({}, { replace: true });
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Saves a passkey's new name.
   * @param event - the rename form's submit.
   * @param id - the passkey.
   */
  function handleRename(event: FormEvent, id: string) {
    event.preventDefault();
    void change(async () => {
      await renamePasskey(id, renameValue);
      setRenamingId(null);
    });
  }

  /**
   * Creates a passkey on this device and adds it to the account.
   * @param event - the add form's submit.
   */
  function handleAddPasskey(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    createPasskey(passkeyName.trim() || DEFAULT_PASSKEY_NAME)
      .then(async () => {
        setPasskeyName("");
        await refresh();
      })
      .catch((err: unknown) => setError(passkeyErrorMessage(err)))
      .finally(() => setBusy(false));
  }

  const isLast = methods?.length === 1;
  const smallButton = "px-3 py-1 rounded border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-card)] disabled:opacity-50 transition-colors";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Sign-in methods</h1>
      <p className="text-[var(--color-text-muted)] mb-6">
        Every way you can sign in to this account. Keep at least two, so losing one doesn't lock you out.
      </p>

      {/* A failed provider round trip, or a failed change on this page. */}
      {(error ?? addError) && (
        <p role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error ?? addError}
        </p>
      )}

      {!methods && !error && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {methods && (
        <ul className="space-y-2 mb-8">
          {/* One row per method: what it is, when it was added and last used, and its actions. */}
          {methods.map((method) => (
            <li key={method.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
              {renamingId === method.id ? (
                <form onSubmit={(event) => handleRename(event, method.id)} className="flex flex-1 flex-wrap gap-2">
                  <label className="sr-only" htmlFor={`rename-${method.id}`}>
                    Passkey name
                  </label>
                  <input
                    id={`rename-${method.id}`}
                    value={renameValue}
                    maxLength={40}
                    onChange={(event) => setRenameValue(event.target.value)}
                    className="flex-1 min-w-0 px-3 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-base"
                  />
                  <button type="submit" disabled={busy} className={smallButton}>
                    Save
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)} className={smallButton}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      <span className="text-[var(--color-text-muted)]">{KIND_LABELS[method.kind]}:</span> {method.label}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Added {shortDate(method.createdAt)} · Last used {shortDate(method.lastUsedAt)}
                    </p>
                  </div>
                  {/* Only passkeys have a name of their own to change. */}
                  {method.kind === "passkey" && (
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(method.id);
                        setRenameValue(method.label);
                      }}
                      className={smallButton}
                    >
                      Rename
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy || isLast}
                    title={isLast ? "This is your only way to sign in. Add another first." : undefined}
                    onClick={() => change(() => removeSignInMethod(method.id))}
                    className={smallButton}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* Say why Remove is disabled, not just grey it out. */}
      {isLast && <p className="-mt-6 mb-8 text-sm text-[var(--color-text-muted)]">This is your only way to sign in, so it can't be removed. Add another first.</p>}

      <h2 className="text-lg font-semibold mb-3">Add a sign-in method</h2>
      {available && (
        <div className="space-y-6">
          {/* A provider: round trip through it, coming back here. */}
          {available.providers.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {available.providers.map((provider) => (
                <ProviderButton key={provider} provider={provider} href={providerSignInUrl(provider, "/account/sign-in", "add")}>
                  Add {PROVIDER_LABELS[provider]}
                </ProviderButton>
              ))}
            </div>
          )}

          {/* A passkey made on this device. */}
          {available.passkeys && canUsePasskeys() && (
            <form onSubmit={handleAddPasskey} className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium flex-1 min-w-48">
                Passkey name
                <input
                  value={passkeyName}
                  maxLength={40}
                  placeholder="e.g. Bob's iPhone"
                  onChange={(event) => setPasskeyName(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-base"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 items-center gap-2 px-3 rounded border border-[var(--color-primary)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                <PasskeyIcon />
                Add passkey
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
