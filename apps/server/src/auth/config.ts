import { PROVIDERS, type Provider } from "@familypassportmap/shared";
import { isE2eFakeAuthEnabled } from "./e2eFakeAuth.js";

// Sign-in settings (Phase 13). Each provider is enabled only when both its client id and secret
// are set; email codes only when every mail setting is set. Everything is read per call, never at
// import, so tests and local runs can change settings and nothing needs a restart to be checked.

/** The client id and secret settings for each provider. */
const PROVIDER_SETTINGS: Record<Provider, { id: string; secret: string }> = {
  microsoft: { id: "MICROSOFT_CLIENT_ID", secret: "MICROSOFT_CLIENT_SECRET" },
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  github: { id: "GITHUB_CLIENT_ID", secret: "GITHUB_CLIENT_SECRET" },
};

/** The settings email codes need. All must be set, or email codes are off. */
export const MAIL_SETTINGS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM"] as const;

/** Everything a provider adapter needs to talk to its provider. */
export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  /** Where the provider sends the browser back to; must be registered with the provider. */
  redirectUri: string;
}

/**
 * Whether a provider's client id and secret are both set. Under the E2E fake sign-in every
 * provider counts as set up, since the fake page stands in for all of them.
 * @param provider - the provider.
 * @param env - the environment to check (defaults to `process.env`).
 * @returns true when the provider's button should show.
 */
export function isProviderEnabled(provider: Provider, env: NodeJS.ProcessEnv = process.env): boolean {
  // The fake sign-in page stands in for every provider during E2E runs.
  if (isE2eFakeAuthEnabled(env)) return true;
  const { id, secret } = PROVIDER_SETTINGS[provider];
  return !!env[id] && !!env[secret];
}

/**
 * The providers that are set up, in display order.
 * @param env - the environment to check (defaults to `process.env`).
 * @returns the enabled providers.
 */
export function enabledProviders(env: NodeJS.ProcessEnv = process.env): Provider[] {
  return PROVIDERS.filter((provider) => isProviderEnabled(provider, env));
}

/**
 * Whether email codes can be sent: every mail setting is set (or the E2E fake sign-in is on, which
 * reads codes from an in-memory outbox instead of sending them).
 * @param env - the environment to check (defaults to `process.env`).
 * @returns true when email codes are offered.
 */
export function isEmailCodesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  // E2E runs read codes from the in-memory outbox; no mail service needed.
  if (isE2eFakeAuthEnabled(env)) return true;
  return MAIL_SETTINGS.every((name) => !!env[name]);
}

/**
 * What production needs to start: `APP_BASE_URL`, and at least one sign-in method that works
 * without the browser's help (a provider or email codes). Passkeys don't count: they need no
 * settings, so counting them would make the rule always pass, and an existing account can't
 * sign in with a passkey it doesn't have yet.
 * @param env - the environment to check (defaults to `process.env`).
 * @returns a list of problems; empty when the server may start.
 */
export function startupProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  // Every redirect URI and the passkey domain come from the public address.
  if (!env.APP_BASE_URL) problems.push("missing app setting APP_BASE_URL");
  // Nobody could sign in at all without a provider or email codes.
  if (enabledProviders(env).length === 0 && !isEmailCodesEnabled(env)) {
    problems.push(
      "no sign-in method is configured (set a provider's CLIENT_ID and CLIENT_SECRET, or all of " +
        `${MAIL_SETTINGS.join(", ")})`,
    );
  }
  return problems;
}

/**
 * The public address the app is served at, from `APP_BASE_URL`.
 * @returns the URL.
 * @throws if it isn't set.
 */
export function appBaseUrl(): URL {
  // Read per call so a missing setting fails the one sign-in that needs it, with a clear message.
  if (!process.env.APP_BASE_URL) throw new Error("Sign-in is not configured: missing APP_BASE_URL");
  return new URL(process.env.APP_BASE_URL);
}

/**
 * Reads one provider's settings.
 * @param provider - the provider.
 * @returns its config, with the redirect URI built from `APP_BASE_URL`.
 * @throws if the provider isn't set up or `APP_BASE_URL` is missing.
 */
export function providerConfig(provider: Provider): ProviderConfig {
  const { id, secret } = PROVIDER_SETTINGS[provider];
  // Fail with the exact setting names so a misconfigured deploy is easy to fix.
  if (!process.env[id] || !process.env[secret]) {
    throw new Error(`${provider} sign-in is not configured: set ${id} and ${secret}`);
  }
  return {
    clientId: process.env[id]!,
    clientSecret: process.env[secret]!,
    redirectUri: new URL(`/api/auth/${provider}/callback`, appBaseUrl()).toString(),
  };
}

/**
 * Whether a signed-in User is the site owner, who Adopts the Legacy People. The email is compared
 * case-insensitively against `LEGACY_DATA_OWNER_EMAIL`, read per call (so tests can change it).
 * Only a personal Microsoft account qualifies: a work or school directory's admin can give an
 * account any email, so a matching email there proves nothing. Unset or empty means nobody is
 * the site owner, and Legacy People stay invisible.
 * @param email - the User's email, as Microsoft reported it.
 * @param isPersonalAccount - whether they signed in with a personal Microsoft account.
 * @returns true when this User should Adopt the Legacy People.
 */
export function isLegacyDataOwner(email: string, isPersonalAccount: boolean): boolean {
  const ownerEmail = process.env.LEGACY_DATA_OWNER_EMAIL?.trim().toLowerCase();
  return isPersonalAccount && !!ownerEmail && email.trim().toLowerCase() === ownerEmail;
}
