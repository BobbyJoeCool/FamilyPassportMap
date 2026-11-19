import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it, expect, afterEach } from "vitest";
import {
  fakeAuthorizationUrl,
  fakeIdentityFromCode,
  isE2eFakeAuthEnabled,
  isE2eFakeAuthMisconfigured,
} from "../src/auth/e2eFakeAuth.js";
import { newAgent } from "./helpers.js";

const run = promisify(execFile);
const serverRoot = path.resolve(import.meta.dirname, "..");

afterEach(() => {
  delete process.env.E2E_FAKE_AUTH;
});

describe("E2E fake sign-in settings", () => {
  it("is on only for E2E_FAKE_AUTH=true outside production", () => {
    expect(isE2eFakeAuthEnabled({ E2E_FAKE_AUTH: "true", NODE_ENV: "development" })).toBe(true);
    expect(isE2eFakeAuthEnabled({ E2E_FAKE_AUTH: "true" })).toBe(true);
    expect(isE2eFakeAuthEnabled({ E2E_FAKE_AUTH: "true", NODE_ENV: "production" })).toBe(false);
    // Only the exact string "true" counts.
    for (const value of [undefined, "", "1", "TRUE", "yes"]) {
      expect(isE2eFakeAuthEnabled({ E2E_FAKE_AUTH: value })).toBe(false);
    }
  });

  it("flags E2E_FAKE_AUTH=true together with production as a misconfiguration", () => {
    expect(isE2eFakeAuthMisconfigured({ E2E_FAKE_AUTH: "true", NODE_ENV: "production" })).toBe(true);
    expect(isE2eFakeAuthMisconfigured({ E2E_FAKE_AUTH: "true", NODE_ENV: "development" })).toBe(false);
    expect(isE2eFakeAuthMisconfigured({ NODE_ENV: "production" })).toBe(false);
  });

  it("builds a local sign-in page URL carrying the state", () => {
    expect(fakeAuthorizationUrl("a+b/c")).toBe("/api/auth/e2e/authorize?state=a%2Bb%2Fc");
  });

  it("turns a user name into a personal-account identity", async () => {
    await expect(fakeIdentityFromCode("alice")).resolves.toEqual({
      subject: "e2e-alice",
      email: "alice@e2e.test",
      name: "Alice",
      isPersonalAccount: true,
    });
  });

  it("rejects anything that isn't a short lowercase user name", async () => {
    // Uppercase, spaces, markup, empty and over-long names are all refused.
    for (const code of ["Alice", "a b", "<script>", "", "x".repeat(41)]) {
      await expect(fakeIdentityFromCode(code)).rejects.toThrow("Not a valid fake E2E user name");
    }
  });
});

describe("E2E fake sign-in routes", () => {
  it("don't exist, and sign-in still goes to Microsoft, when fake sign-in is off", async () => {
    const agent = newAgent();
    // Answered exactly like any unknown API path (the sign-in gate's 401), with no fake page.
    const page = await agent.get("/api/auth/e2e/authorize?state=x");
    const unknown = await agent.get("/api/auth/no-such-route");
    expect(page.status).toBe(unknown.status);
    expect(page.text).not.toContain("Fake sign-in");
    const start = await agent.get("/api/auth/microsoft");
    expect(start.headers.location).toMatch(/^https:\/\/login\.microsoftonline\.test\//);
  });

  it("sign a browser in end to end through the fake page when on", async () => {
    process.env.E2E_FAKE_AUTH = "true";
    const agent = newAgent();

    const start = await agent.get("/api/auth/microsoft").query({ returnTo: "/people" });
    expect(start.status).toBe(302);
    const pageUrl = new URL(start.headers.location, "http://localhost");
    expect(pageUrl.pathname).toBe("/api/auth/e2e/authorize");
    const state = pageUrl.searchParams.get("state")!;

    const page = await agent.get(pageUrl.pathname + pageUrl.search);
    expect(page.status).toBe(200);
    expect(page.text).toContain('action="/api/auth/microsoft/callback"');
    expect(page.text).toContain(`value="${state}"`);

    const callback = await agent.get("/api/auth/microsoft/callback").query({ code: "carol", state });
    // A brand-new User goes to the welcome step first.
    expect(callback.headers.location).toBe("/welcome");
    const me = await agent.get("/api/me");
    expect(me.body.user).toMatchObject({ email: "carol@e2e.test", displayName: "Carol" });
  });

  it("escape the state on the fake page", async () => {
    process.env.E2E_FAKE_AUTH = "true";
    const page = await newAgent().get("/api/auth/e2e/authorize").query({ state: '"><script>alert(1)</script>' });
    expect(page.text).not.toContain("<script>alert(1)</script>");
    expect(page.text).toContain("&#34;&#62;&#60;script&#62;");
  });

  it("end on the sign-in page for an invalid fake user name", async () => {
    process.env.E2E_FAKE_AUTH = "true";
    const agent = newAgent();
    const start = await agent.get("/api/auth/microsoft");
    const state = new URL(start.headers.location, "http://localhost").searchParams.get("state");
    const callback = await agent.get("/api/auth/microsoft/callback").query({ code: "Not Valid", state });
    expect(callback.headers.location).toBe("/signin?error=failed");
  });
});

describe("Server startup with E2E fake sign-in", () => {
  it("refuses to start in production with E2E_FAKE_AUTH=true", async () => {
    // Microsoft settings are filled in so this check, not the missing-settings one, is what fails.
    const start = run(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: serverRoot,
      env: {
        ...process.env,
        NODE_ENV: "production",
        E2E_FAKE_AUTH: "true",
        PORT: "0",
        MICROSOFT_CLIENT_ID: "id",
        MICROSOFT_CLIENT_SECRET: "secret",
        APP_BASE_URL: "https://example.test",
      },
      // If the check were missing, the server would start and listen forever.
      timeout: 10_000,
    });

    await expect(start).rejects.toMatchObject({
      killed: false,
      stderr: expect.stringContaining("Refusing to start: E2E_FAKE_AUTH must never be set in production"),
    });
  });
});
