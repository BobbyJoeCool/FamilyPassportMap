import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";

// The real Google and GitHub adapters (every other test uses fakes), checked against stand-ins for
// the providers' endpoints: `fetch` is replaced, so nothing here reaches Google or GitHub.

const google = await vi.importActual<typeof import("../src/auth/google.js")>("../src/auth/google.js");
const github = await vi.importActual<typeof import("../src/auth/github.js")>("../src/auth/github.js");

/** A JSON response for the stand-in endpoints. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Google adapter", () => {
  let privateKey: CryptoKey;
  let publicJwk: JWK;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  });

  /**
   * A Google-style ID token signed with the test key.
   * @param claims - the token's claims.
   * @param overrides - a different audience or issuer, to test refusals.
   * @returns the signed token.
   */
  function idToken(claims: Record<string, unknown>, overrides: { audience?: string; issuer?: string } = {}) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(overrides.issuer ?? "https://accounts.google.com")
      .setAudience(overrides.audience ?? "test-google-id")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  }

  /**
   * Replaces Google's token and key endpoints.
   * @param token - the ID token the token endpoint hands out.
   * @returns the fetch stand-in, to check what was sent.
   */
  function stubGoogle(token: string) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // The signing keys, then the code exchange.
      if (url.includes("/oauth2/v3/certs")) return json({ keys: [publicJwk] });
      if (url.includes("oauth2.googleapis.com/token")) return json({ id_token: token });
      return json({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("builds a sign-in URL asking for openid, email and profile, with the account chooser", () => {
    const url = new URL(google.googleAuthorizationUrl("st"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "test-google-id",
      redirect_uri: "http://localhost:5173/api/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state: "st",
      prompt: "select_account",
    });
  });

  it("reads the verified identity from the ID token", async () => {
    const fetchMock = stubGoogle(
      await idToken({ sub: "123", email: "ann@gmail.com", email_verified: true, name: "Ann", picture: "https://pic" }),
    );
    await expect(google.googleIdentityFromCode("the-code")).resolves.toEqual({
      subject: "123",
      email: "ann@gmail.com",
      name: "Ann",
      avatarUrl: "https://pic",
    });
    const tokenCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/token"))!;
    expect(Object.fromEntries(tokenCall[1]!.body as URLSearchParams)).toMatchObject({ code: "the-code", grant_type: "authorization_code" });
  });

  it("drops an email Google hasn't verified", async () => {
    stubGoogle(await idToken({ sub: "123", email: "ann@example.com", email_verified: false }));
    await expect(google.googleIdentityFromCode("c")).resolves.toMatchObject({ email: null, name: null, avatarUrl: null });
  });

  it("refuses a token meant for another app, or from another issuer", async () => {
    stubGoogle(await idToken({ sub: "123" }, { audience: "someone-else" }));
    await expect(google.googleIdentityFromCode("c")).rejects.toThrow();
    stubGoogle(await idToken({ sub: "123" }, { issuer: "https://evil.example" }));
    await expect(google.googleIdentityFromCode("c")).rejects.toThrow();
  });

  it("fails when Google rejects the code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_grant" }, 400)));
    await expect(google.googleIdentityFromCode("c")).rejects.toThrow("Google token exchange failed: invalid_grant");
  });
});

describe("the GitHub adapter", () => {
  /**
   * Replaces GitHub's token endpoint and API.
   * @param user - what GET /user returns.
   * @param emails - what GET /user/emails returns.
   * @returns the fetch stand-in.
   */
  function stubGitHub(user: unknown, emails: unknown) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // The code exchange, then the two API calls.
      if (url.includes("/login/oauth/access_token")) return json({ access_token: "tok", token_type: "bearer" });
      if (url.endsWith("/user/emails")) return json(emails);
      if (url.endsWith("/user")) return json(user);
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("builds a sign-in URL asking for the profile and email list", () => {
    const url = new URL(github.githubAuthorizationUrl("st"));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "test-github-id",
      redirect_uri: "http://localhost:5173/api/auth/github/callback",
      scope: "read:user user:email",
      state: "st",
    });
  });

  it("uses the numeric id, the profile name, and the verified primary email", async () => {
    const fetchMock = stubGitHub({ id: 42, login: "ann-dev", name: "Ann", avatar_url: "https://avatars/42" }, [
      { email: "old@example.com", primary: false, verified: true },
      { email: "ann@example.com", primary: true, verified: true },
    ]);
    await expect(github.githubIdentityFromCode("c")).resolves.toEqual({
      subject: "42",
      email: "ann@example.com",
      name: "Ann",
      avatarUrl: "https://avatars/42",
    });
    const apiCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/user"))!;
    expect((apiCall[1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("falls back to the username, and has no email when the primary one isn't verified", async () => {
    stubGitHub({ id: 7, login: "ann-dev", name: null }, [{ email: "ann@example.com", primary: true, verified: false }]);
    await expect(github.githubIdentityFromCode("c")).resolves.toEqual({ subject: "7", email: null, name: "ann-dev", avatarUrl: null });
  });

  it("fails on GitHub's 200-with-an-error answer to a bad code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "bad_verification_code" })));
    await expect(github.githubIdentityFromCode("c")).rejects.toThrow("GitHub token exchange failed: bad_verification_code");
  });

  it("fails when the API refuses the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => (String(input).includes("access_token") ? json({ access_token: "t" }) : json({}, 401))),
    );
    await expect(github.githubIdentityFromCode("c")).rejects.toThrow("GitHub API /user failed: 401");
  });
});
