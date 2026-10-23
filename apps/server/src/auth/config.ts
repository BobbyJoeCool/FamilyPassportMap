/** Settings Google sign-in needs. Production refuses to start without all of them. */
export const REQUIRED_AUTH_SETTINGS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_BASE_URL"] as const;

/** Everything the Google adapter needs to talk to Google. */
export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Where Google sends the browser back to — must be registered on the OAuth client. */
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
 * Reads the Google sign-in settings. Read lazily (per sign-in), not at import, so tests and
 * local runs without Google configured still start.
 * @returns the config.
 * @throws if any required setting is missing.
 */
export function googleConfig(): GoogleConfig {
  const missing = missingAuthSettings();
  // Fail with the exact setting names so a misconfigured deploy is easy to fix.
  if (missing.length > 0) {
    throw new Error(`Google sign-in is not configured: missing ${missing.join(", ")}`);
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: new URL("/api/auth/google/callback", process.env.APP_BASE_URL).toString(),
  };
}

/**
 * Whether a signed-in email belongs to the site owner, who Adopts the Legacy People. Compared
 * case-insensitively against `LEGACY_DATA_OWNER_EMAIL`, read per call (so tests can change it).
 * Unset or empty means nobody is the site owner, and Legacy People stay invisible.
 * @param email - the User's verified email.
 * @returns true when this User should Adopt the Legacy People.
 */
export function isLegacyDataOwner(email: string): boolean {
  const ownerEmail = process.env.LEGACY_DATA_OWNER_EMAIL?.trim().toLowerCase();
  return !!ownerEmail && email.trim().toLowerCase() === ownerEmail;
}
