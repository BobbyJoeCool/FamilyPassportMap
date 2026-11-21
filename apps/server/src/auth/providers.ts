import type { Provider } from "@familypassportmap/shared";
import { githubAuthorizationUrl, githubIdentityFromCode } from "./github.js";
import { googleAuthorizationUrl, googleIdentityFromCode } from "./google.js";
import { microsoftAuthorizationUrl, microsoftIdentityFromCode } from "./microsoft.js";

// The provider registry (Phase 13): one adapter per provider, each the ONLY code that talks to its
// provider. Tests replace each adapter module with a fake (tests/setup.ts); E2E runs use the fake
// sign-in page instead (e2eFakeAuth.ts). Adding a provider means a new adapter module, an entry
// here, and its settings in config.ts.

/** Who a provider says signed in, in the same shape for every provider. */
export interface ProviderIdentity {
  /** The provider's stable user id. Never changes, unlike email. */
  subject: string;
  /** The account's email, for display only. Null if the provider gave none. */
  email: string | null;
  /** The account's name, if the provider gives one. */
  name: string | null;
  /** The account's profile-picture URL, or null (Microsoft sends none). */
  avatarUrl: string | null;
  /**
   * True only for a personal Microsoft account, the one kind of account allowed to Adopt the
   * Legacy People (its email is Microsoft's to vouch for).
   */
  isPersonalMicrosoftAccount: boolean;
}

/** What each provider adapter offers. */
export interface ProviderAdapter {
  /**
   * The provider's sign-in page URL.
   * @param state - the anti-forgery value the provider echoes back to the callback.
   */
  authorizationUrl(state: string): string;
  /**
   * Exchanges the callback's code for a verified identity.
   * @param code - the `code` query parameter from the callback.
   * @throws if the exchange or verification fails.
   */
  identityFromCode(code: string): Promise<ProviderIdentity>;
}

/** The adapter for each provider. */
const ADAPTERS: Record<Provider, ProviderAdapter> = {
  microsoft: {
    authorizationUrl: (state) => microsoftAuthorizationUrl(state),
    async identityFromCode(code) {
      const identity = await microsoftIdentityFromCode(code);
      // Microsoft's ID token carries no picture.
      return {
        subject: identity.subject,
        email: identity.email,
        name: identity.name,
        avatarUrl: null,
        isPersonalMicrosoftAccount: identity.isPersonalAccount,
      };
    },
  },
  google: {
    authorizationUrl: (state) => googleAuthorizationUrl(state),
    async identityFromCode(code) {
      return { ...(await googleIdentityFromCode(code)), isPersonalMicrosoftAccount: false };
    },
  },
  github: {
    authorizationUrl: (state) => githubAuthorizationUrl(state),
    async identityFromCode(code) {
      return { ...(await githubIdentityFromCode(code)), isPersonalMicrosoftAccount: false };
    },
  },
};

/**
 * The adapter for a provider.
 * @param provider - the provider.
 * @returns its adapter.
 */
export function providerAdapter(provider: Provider): ProviderAdapter {
  return ADAPTERS[provider];
}
