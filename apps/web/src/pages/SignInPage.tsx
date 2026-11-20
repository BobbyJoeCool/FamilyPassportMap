import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DEFAULT_LANDING_PATH,
  PROVIDER_LABELS,
  SIGN_IN_ERRORS,
  TAKEN_MESSAGE,
  type AvailableSignInMethods,
  type SignInError,
} from "@familypassportmap/shared";
import { createPasskey, fetchAvailableSignInMethods, providerSignInUrl, signInWithEmailCode, signInWithPasskey, startEmailCode } from "../api/auth";
import { EmailCodeForm } from "../components/EmailCodeForm";
import { loadPage } from "../navigation";
import { canUsePasskeys, passkeyErrorMessage } from "../passkeySupport";

/** What to tell the visitor for each way sign-in can fail (the `error` query value). */
const ERROR_MESSAGES: Record<SignInError, string> = {
  cancelled: "Sign-in was cancelled.",
  failed: "Sign-in didn't work. Please try again.",
  taken: TAKEN_MESSAGE,
};

/**
 * The public sign-in page: every signed-out visit lands here. Offers whichever sign-in methods the
 * server has set up (`GET /api/auth/methods`): a button per provider, a passkey, and an Email code.
 * Any of them signs in, or creates an account the first time, then returns to `returnTo`.
 */
export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") ?? DEFAULT_LANDING_PATH;
  const error = params.get("error");
  // No error → no message. An error code we don't recognize still gets the generic message.
  const errorMessage =
    error === null ? null : ERROR_MESSAGES[SIGN_IN_ERRORS.find((known) => known === error) ?? "failed"];

  const [methods, setMethods] = useState<AvailableSignInMethods | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAvailableSignInMethods()
      .then((available) => {
        // Ignore a response that lands after unmount (StrictMode double-mount in dev).
        if (!cancelled) setMethods(available);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Runs a passkey ceremony, then loads the page it leads to (a full load, so the app starts over
   * signed in).
   * @param ceremony - sign in with an existing passkey, or create an account with a new one.
   */
  async function handlePasskey(ceremony: () => Promise<{ redirectTo: string } | undefined>) {
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      const result = await ceremony();
      loadPage(result?.redirectTo ?? returnTo);
    } catch (err) {
      setPasskeyError(passkeyErrorMessage(err));
      setPasskeyBusy(false);
    }
  }

  const showPasskeys = !!methods?.passkeys && canUsePasskeys();
  const primaryButton =
    "block w-full px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors disabled:opacity-50";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-heading)] mb-2">🗺️ FamilyPassportMap</h1>
        <p className="text-[var(--color-text-muted)] mb-6">Track where you and your family have been.</p>

        {/* Only shown after a failed or cancelled attempt. */}
        {errorMessage && (
          <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
            {errorMessage}
          </p>
        )}

        {/* Until the server says which methods exist, show nothing that might not work. */}
        {loadError && <p className="text-sm text-[var(--color-danger)]">Couldn't load the sign-in options. Refresh to try again.</p>}
        {!methods && !loadError && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}

        {methods && (
          <div className="space-y-3">
            {/* One button per provider set up on the server. Plain links: the browser must leave and come back. */}
            {methods.providers.map((provider) => (
              <a key={provider} href={providerSignInUrl(provider, returnTo)} className={primaryButton}>
                Continue with {PROVIDER_LABELS[provider]}
              </a>
            ))}

            {/* Passkeys need browser support and a secure page (https or localhost). */}
            {showPasskeys && (
              <div className="space-y-1">
                <button type="button" disabled={passkeyBusy} onClick={() => handlePasskey(() => signInWithPasskey(returnTo))} className={primaryButton}>
                  Sign in with a passkey
                </button>
                <button
                  type="button"
                  disabled={passkeyBusy}
                  onClick={() => handlePasskey(() => createPasskey())}
                  className="text-sm underline text-[var(--color-text-muted)]"
                >
                  New here? Create an account with a passkey
                </button>
                {passkeyError && (
                  <p role="alert" className="text-sm text-[var(--color-danger)]">
                    {passkeyError}
                  </p>
                )}
              </div>
            )}

            {/* Email codes need a mail service on the server. */}
            {methods.emailCodes && (
              <>
                {/* A divider, only when there's something above to divide from. */}
                {(methods.providers.length > 0 || showPasskeys) && (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className="flex-1 border-t border-[var(--color-border)]" />
                    or
                    <span className="flex-1 border-t border-[var(--color-border)]" />
                  </div>
                )}
                <EmailCodeForm
                  sendLabel="Email me a code"
                  verifyLabel="Sign in"
                  onSend={(email) => startEmailCode(email, "sign-in")}
                  onVerify={async (email, code) => loadPage((await signInWithEmailCode(email, code, returnTo)).redirectTo)}
                />
              </>
            )}
          </div>
        )}

        <Link to="/privacy" className="inline-block mt-4 text-sm text-[var(--color-text-muted)] underline">
          Privacy
        </Link>
      </div>
    </div>
  );
}
