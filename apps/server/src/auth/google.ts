import { createRemoteJWKSet, jwtVerify } from "jose";
import { providerConfig } from "./config.js";

// The Google identity adapter: the ONLY code that talks to Google. Google sign-in is OpenID
// Connect, like Microsoft's: the browser is sent to Google, comes back with a one-time code, and
// the server swaps that code for a signed ID token it verifies. Tests replace this module with a
// fake (tests/setup.ts); tests/providerAdapters.test.ts checks the real one against stand-ins for
// Google's endpoints.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Google's ID-token signing keys, fetched on first use and cached (and rotated) by jose. */
const signingKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** The two issuer spellings Google's ID tokens use. */
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Who Google says signed in. */
export interface GoogleIdentity {
  /** Google's stable user id ("sub"). Never changes, unlike email. */
  subject: string;
  /** The account's email, only when Google has verified it; for display. */
  email: string | null;
  name: string | null;
  /** The account's profile-picture URL. */
  avatarUrl: string | null;
}

/**
 * The Google sign-in page URL the browser is sent to.
 * @param state - the anti-forgery value Google echoes back to the callback.
 * @returns the URL to redirect to.
 */
export function googleAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = providerConfig("google");
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // openid = an ID token; email and profile = the email, name and picture claims in it.
    scope: "openid email profile",
    state,
    // Always show the account chooser, so a shared device doesn't silently reuse an account.
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/**
 * Exchanges the callback's code for Google's ID token, verifies it, and reads the identity.
 * @param code - the `code` query parameter Google sent to the callback.
 * @returns the verified identity.
 * @throws if the exchange or verification fails.
 */
export async function googleIdentityFromCode(code: string): Promise<GoogleIdentity> {
  const { clientId, clientSecret, redirectUri } = providerConfig("google");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await response.json()) as { id_token?: string; error?: string; error_description?: string };
  // A rejected code (or bad client secret) comes back as an error body, not an ID token.
  if (!response.ok || !tokens.id_token) {
    throw new Error(`Google token exchange failed: ${tokens.error ?? response.status} ${tokens.error_description ?? ""}`);
  }

  // Signed by Google, meant for this app, issued by Google: otherwise it's not proof of anything.
  const { payload } = await jwtVerify(tokens.id_token, signingKeys, { audience: clientId, issuer: GOOGLE_ISSUERS });
  const claims = payload as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  // A token without a subject can't identify a User.
  if (!claims.sub) throw new Error("Google ID token is missing sub");

  return {
    subject: claims.sub,
    // An unverified email is someone's claim, not a fact; don't show it as theirs.
    email: claims.email && claims.email_verified ? claims.email : null,
    name: claims.name || null,
    avatarUrl: claims.picture || null,
  };
}
