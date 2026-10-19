import { Link, useSearchParams } from "react-router-dom";
import { DEFAULT_LANDING_PATH, SIGN_IN_ERRORS, type SignInError } from "@familypassportmap/shared";
import { googleSignInUrl } from "../api/auth";

/** What to tell the visitor for each way sign-in can fail (the `error` query value). */
const ERROR_MESSAGES: Record<SignInError, string> = {
  cancelled: "Sign-in was cancelled.",
  failed: "Sign-in didn't work. Please try again.",
  unverified: "Your Google email isn't verified, so we can't sign you in.",
};

/**
 * The public sign-in page: every signed-out visit lands here. Shows why the last attempt
 * failed (if it did) and starts Google sign-in, coming back to `returnTo` afterwards.
 */
export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") ?? DEFAULT_LANDING_PATH;
  const error = params.get("error");
  // No error → no message. An error code we don't recognize still gets the generic message.
  const errorMessage =
    error === null ? null : ERROR_MESSAGES[SIGN_IN_ERRORS.find((known) => known === error) ?? "failed"];

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-heading)] mb-2">🗺️ FamilyPassportMap</h1>
        <p className="text-[var(--color-text-muted)] mb-6">Track where you and your family have been.</p>

        {/* Only shown after a failed or cancelled attempt. */}
        {errorMessage && (
          <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
            {errorMessage}
          </p>
        )}

        {/* A plain link, not a router Link: the browser must leave for Google and come back. */}
        <a
          href={googleSignInUrl(returnTo)}
          className="block w-full px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors"
        >
          Sign in with Google
        </a>

        <Link to="/privacy" className="inline-block mt-4 text-sm text-[var(--color-text-muted)] underline">
          Privacy
        </Link>
      </div>
    </div>
  );
}
