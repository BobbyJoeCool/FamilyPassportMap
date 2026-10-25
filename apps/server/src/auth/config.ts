/** Settings Microsoft sign-in needs. Production refuses to start without all of them. */
export const REQUIRED_AUTH_SETTINGS = ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "APP_BASE_URL"] as const;

/** Everything the Microsoft adapter needs to talk to Microsoft. */
export interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  /** Where Microsoft sends the browser back to — must be registered on the app registration. */
  redirectUri: string;
}

/**
 * Lists the required sign-in settings that are missing or empty.
 * @param env - the environment to check (defaults to `process.env`).
 * @returns the names of missing settings; empty when sign-in is fully configured.
 */
export function missingAuthSettings(env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_AUTH_SETTINGS.filter((name) => !env[name]);
}

/**
 * Reads the Microsoft sign-in settings. Read lazily (per sign-in), not at import, so tests and
 * local runs without Microsoft configured still start.
 * @returns the config.
 * @throws if any required setting is missing.
 */
export function microsoftConfig(): MicrosoftConfig {
  const missing = missingAuthSettings();
  // Fail with the exact setting names so a misconfigured deploy is easy to fix.
  if (missing.length > 0) {
    throw new Error(`Microsoft sign-in is not configured: missing ${missing.join(", ")}`);
  }
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    redirectUri: new URL("/api/auth/microsoft/callback", process.env.APP_BASE_URL).toString(),
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
