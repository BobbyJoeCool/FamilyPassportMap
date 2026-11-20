// Sign-in rules shared by the server (which enforces them) and the web app (which follows them).
import { z } from "zod";

/** Where a signed-in User lands when no (valid) return path was given. */
export const DEFAULT_LANDING_PATH = "/us/map";

/**
 * Why a sign-in (or adding a sign-in method) didn't complete; the server sends it to the sign-in
 * page or the Sign-in methods page as `?error=`. "taken": that sign-in already belongs to another
 * account (adding only).
 */
export const SIGN_IN_ERRORS = ["cancelled", "failed", "taken"] as const;
export type SignInError = (typeof SIGN_IN_ERRORS)[number];

/** The outside accounts a User can sign in with (Phase 13). Apple would be the next one. */
export const PROVIDERS = ["microsoft", "google", "github"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** How each provider is named on buttons and the Sign-in methods page. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  microsoft: "Microsoft",
  google: "Google",
  github: "GitHub",
};

/** Whether a value is one of the providers. */
export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

/** Every kind of sign-in method, as `GET /api/me/sign-in-methods` reports them. */
export type SignInMethodKind = Provider | "email" | "passkey";

/** What a provider sign-in start is for: signing in (or up), or adding to the signed-in account. */
export type SignInIntent = "sign-in" | "add";

/** Response of `GET /api/auth/methods`: which ways to sign in this server offers. */
export interface AvailableSignInMethods {
  /** Providers with a client id and secret configured, in display order. */
  providers: Provider[];
  /** Email codes need a mail service configured. */
  emailCodes: boolean;
  /** Passkeys need no settings; the browser must also be in a secure context. */
  passkeys: boolean;
}

/** One entry of `GET /api/me/sign-in-methods`. */
export interface SignInMethodSummary {
  id: string;
  kind: SignInMethodKind;
  /** The account's email, the email address itself, or the passkey's name. */
  label: string;
  createdAt: string;
  lastUsedAt: string;
}

/** Response of `GET /api/me/sign-in-methods`. */
export interface SignInMethodsResponse {
  methods: SignInMethodSummary[];
}

/** Shown (409) when removing a User's last sign-in method. */
export const LAST_METHOD_MESSAGE = "This is your only way to sign in, so it can't be removed. Add another first.";

/** Shown when a sign-in method being added already belongs to another account. */
export const TAKEN_MESSAGE = "That sign-in already belongs to another account.";

/**
 * Accepts a post-sign-in destination only if it's a path inside this app, so a crafted
 * sign-in link can't bounce the User to another site.
 * @param value - the requested return path (untrusted input).
 * @returns the path to use: the value itself, or `DEFAULT_LANDING_PATH`.
 */
export function safeReturnTo(value: unknown): string {
  // Must be a same-origin relative path: one leading "/", not "//host" or "/\host"
  // (both of which browsers treat as another origin).
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return DEFAULT_LANDING_PATH;
}

// --- Email codes (Phase 13) ---

/** What an email code is for: signing in (or up), or adding the address to the signed-in account. */
export const EMAIL_CODE_PURPOSES = ["sign-in", "add-email"] as const;
export type EmailCodePurpose = (typeof EMAIL_CODE_PURPOSES)[number];

/** Shown (400) for an address that isn't a valid email. */
export const INVALID_EMAIL_MESSAGE = "Enter a valid email address.";

/** Shown (400) for a wrong, expired, used-up or malformed code. */
export const EMAIL_CODE_FAILED_MESSAGE = "That code didn't work. Check it or send a new one.";

/** An email address as the app stores it: trimmed and lowercased, so one address is one subject. */
export const emailAddressSchema = z
  .string(INVALID_EMAIL_MESSAGE)
  .trim()
  .toLowerCase()
  .max(254, INVALID_EMAIL_MESSAGE)
  .pipe(z.email(INVALID_EMAIL_MESSAGE));

/** Body of `POST /api/auth/email/start`. */
export const emailCodeStartSchema = z.object({
  email: emailAddressSchema,
  purpose: z.enum(EMAIL_CODE_PURPOSES),
});
export type EmailCodeStartInput = z.infer<typeof emailCodeStartSchema>;

/** Body of `POST /api/auth/email/verify`. The code is exactly 6 digits. */
export const emailCodeVerifySchema = z.object({
  email: emailAddressSchema,
  code: z.string(EMAIL_CODE_FAILED_MESSAGE).trim().regex(/^\d{6}$/, EMAIL_CODE_FAILED_MESSAGE),
  purpose: z.enum(EMAIL_CODE_PURPOSES),
  returnTo: z.string().optional(),
});
export type EmailCodeVerifyInput = z.infer<typeof emailCodeVerifySchema>;

/** Response of a successful sign-in through `POST /api/auth/email/verify` (or a passkey). */
export interface SignInResult {
  /** Where to go next: the welcome step, or the page the User was headed for. */
  redirectTo: string;
}
