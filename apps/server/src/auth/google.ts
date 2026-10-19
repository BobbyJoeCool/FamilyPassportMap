import { OAuth2Client } from "google-auth-library";
import { googleConfig } from "./config.js";

// The Google identity adapter: the ONLY code that talks to Google. Tests replace this whole
// module with a fake (tests/setup.ts), so everything else in sign-in is tested for real.

/** Who Google says signed in. */
export interface GoogleIdentity {
  /** Google's stable user id ("sub"). Never changes, unlike email. */
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  pictureUrl: string | null;
}

/**
 * Builds an OAuth client from the current config.
 * @returns a configured Google OAuth client.
 */
function client(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

/**
 * The Google consent-page URL the browser is sent to when signing in.
 * @param state - the anti-forgery value Google echoes back to the callback.
 * @returns the URL to redirect to.
 */
export function googleAuthorizationUrl(state: string): string {
  return client().generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    // Always show the account chooser, so a shared device doesn't silently reuse an account.
    prompt: "select_account",
  });
}

/**
 * Exchanges the callback's authorization code for Google's ID token, verifies it, and reads
 * the identity from it.
 * @param code - the `code` query parameter Google sent to the callback.
 * @returns the verified identity.
 * @throws if the exchange or verification fails.
 */
export async function googleIdentityFromCode(code: string): Promise<GoogleIdentity> {
  const oauth = client();
  const { tokens } = await oauth.getToken(code);
  // An authorization-code exchange with the openid scope always includes an ID token.
  if (!tokens.id_token) {
    throw new Error("Google returned no ID token");
  }

  const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: googleConfig().clientId });
  const payload = ticket.getPayload();
  // The email scope guarantees these; a token without them can't identify a User.
  if (!payload?.sub || !payload.email) {
    throw new Error("Google ID token is missing sub or email");
  }

  return {
    subject: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name ?? payload.email,
    pictureUrl: payload.picture ?? null,
  };
}
