import { providerConfig } from "./config.js";

// The GitHub identity adapter: the ONLY code that talks to GitHub. GitHub sign-in is plain OAuth
// (an "OAuth app"), not OpenID Connect: there's no signed ID token, so after swapping the callback's
// code for an access token, the server asks GitHub's API who the token belongs to. Tests replace this
// module with a fake (tests/setup.ts); tests/providerAdapters.test.ts checks the real one against
// stand-ins for GitHub's endpoints.

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const API_URL = "https://api.github.com";

/** Who GitHub says signed in. */
export interface GitHubIdentity {
  /** GitHub's numeric user id, as text. Never changes, unlike the username or email. */
  subject: string;
  /** The account's primary email, only if GitHub has verified it; for display. */
  email: string | null;
  /** The profile name, or the username when no name is set. */
  name: string | null;
  avatarUrl: string | null;
}

/**
 * The GitHub sign-in page URL the browser is sent to.
 * @param state - the anti-forgery value GitHub echoes back to the callback.
 * @returns the URL to redirect to.
 */
export function githubAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = providerConfig("github");
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    // read:user = the profile; user:email = the email list, including private addresses.
    scope: "read:user user:email",
    state,
  }).toString();
  return url.toString();
}

/**
 * Calls one GitHub API endpoint with an access token.
 * @param path - the API path, e.g. "/user".
 * @param accessToken - the user's token from the code exchange.
 * @returns the parsed JSON.
 * @throws on any error status.
 */
async function githubApi<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      // GitHub's API refuses requests without a User-Agent.
      "User-Agent": "FamilyPassportMap",
    },
  });
  // A revoked or wrong token, or GitHub having trouble: the sign-in fails.
  if (!response.ok) throw new Error(`GitHub API ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Exchanges the callback's code for an access token, then reads the user's profile and verified
 * primary email from GitHub's API.
 * @param code - the `code` query parameter GitHub sent to the callback.
 * @returns the identity.
 * @throws if the exchange or either API call fails.
 */
export async function githubIdentityFromCode(code: string): Promise<GitHubIdentity> {
  const { clientId, clientSecret, redirectUri } = providerConfig("github");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    // Without this GitHub answers in form encoding instead of JSON.
    headers: { Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const tokens = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  // GitHub reports a bad code with a 200 and an error field, so check for the token itself.
  if (!response.ok || !tokens.access_token) {
    throw new Error(`GitHub token exchange failed: ${tokens.error ?? response.status} ${tokens.error_description ?? ""}`);
  }

  const user = await githubApi<{ id?: number; login?: string; name?: string | null; avatar_url?: string }>("/user", tokens.access_token);
  // Without the numeric id there's nothing stable to identify the account by.
  if (typeof user.id !== "number") throw new Error("GitHub user has no id");
  const emails = await githubApi<Array<{ email: string; primary: boolean; verified: boolean }>>("/user/emails", tokens.access_token);
  // Only the primary address, and only once GitHub has verified it.
  const primary = emails.find((entry) => entry.primary && entry.verified);

  return {
    subject: String(user.id),
    email: primary?.email ?? null,
    name: user.name || user.login || null,
    avatarUrl: user.avatar_url || null,
  };
}
