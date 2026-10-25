import { createRemoteJWKSet, jwtVerify } from "jose";
import { microsoftConfig } from "./config.js";

// The Microsoft identity adapter: the ONLY code that talks to Microsoft. Tests replace this whole
// module with a fake (tests/setup.ts), so everything else in sign-in is tested for real.

/**
 * The "common" endpoint accepts any Microsoft account: personal (Outlook, Hotmail, Xbox) and
 * work or school.
 */
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";

/** The tenant id every personal Microsoft account signs in through. */
export const PERSONAL_ACCOUNTS_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad";

/** Microsoft's ID-token signing keys, fetched on first use and cached by jose. */
const signingKeys = createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"));

/** Who Microsoft says signed in. */
export interface MicrosoftIdentity {
  /** Microsoft's stable user id for this app ("sub"). Never changes, unlike email. */
  subject: string;
  /**
   * The account's email, for display. Microsoft doesn't vouch for it on work or school
   * accounts (their directory admin can set any value), so it never identifies anyone.
   */
  email: string;
  name: string;
  /**
   * True for a personal Microsoft account. Only these have an email Microsoft owns the
   * meaning of, so only these may Adopt the Legacy People.
   */
  isPersonalAccount: boolean;
}

/**
 * The Microsoft sign-in page URL the browser is sent to when signing in.
 * @param state - the anti-forgery value Microsoft echoes back to the callback.
 * @returns the URL to redirect to.
 */
export function microsoftAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = microsoftConfig();
  const url = new URL(`${AUTHORITY}/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "openid email profile",
    state,
    // Always show the account chooser, so a shared device doesn't silently reuse an account.
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/**
 * Exchanges the callback's authorization code for Microsoft's ID token, verifies it, and reads
 * the identity from it.
 * @param code - the `code` query parameter Microsoft sent to the callback.
 * @returns the verified identity.
 * @throws if the exchange or verification fails.
 */
export async function microsoftIdentityFromCode(code: string): Promise<MicrosoftIdentity> {
  const { clientId, clientSecret, redirectUri } = microsoftConfig();
  const response = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "openid email profile",
    }),
  });
  const tokens = (await response.json()) as { id_token?: string; error?: string; error_description?: string };
  // A rejected code (or bad client secret) comes back as an error body, not an ID token.
  if (!response.ok || !tokens.id_token) {
    throw new Error(`Microsoft token exchange failed: ${tokens.error ?? response.status} ${tokens.error_description ?? ""}`);
  }

  const { payload } = await jwtVerify(tokens.id_token, signingKeys, { audience: clientId });
  const claims = payload as { sub?: string; tid?: string; email?: string; preferred_username?: string; name?: string };
  // The "common" key set is shared by every tenant, so the issuer must be checked against the
  // token's own tenant id, or a token minted for another tenant's app could pass.
  if (!claims.tid || payload.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) {
    throw new Error("Microsoft ID token has an unexpected issuer");
  }
  // Work accounts may lack the email claim; their sign-in name is the usual stand-in.
  const email = claims.email ?? claims.preferred_username;
  // A token without these can't identify or name a User.
  if (!claims.sub || !email) {
    throw new Error("Microsoft ID token is missing sub or email");
  }

  return {
    subject: claims.sub,
    email,
    name: claims.name || email,
    isPersonalAccount: claims.tid === PERSONAL_ACCOUNTS_TENANT_ID,
  };
}
