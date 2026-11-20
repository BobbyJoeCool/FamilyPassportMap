import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMAIL_CODE_FAILED_MESSAGE, TAKEN_MESSAGE } from "@familypassportmap/shared";
import { prisma } from "../src/db.js";
import { outbox } from "../src/auth/mailer.js";
import { newAgent, signIn, type TestAgent } from "./helpers.js";

// Email codes end to end through the API. Mail goes to the faked mailer's outbox (tests/setup.ts).

const MAIL_ENV = { SMTP_HOST: "smtp.test", SMTP_PORT: "587", SMTP_USER: "u", SMTP_PASSWORD: "p", MAIL_FROM: "codes@test" };

beforeEach(() => {
  Object.assign(process.env, MAIL_ENV);
});

afterEach(() => {
  for (const key of Object.keys(MAIL_ENV)) delete process.env[key];
});

/**
 * The newest code sent to an address.
 * @param to - the address.
 * @returns the 6 digits.
 */
function codeSentTo(to: string): string {
  const message = [...outbox].reverse().find((candidate) => candidate.to === to);
  if (!message) throw new Error(`No email was sent to ${to}`);
  return /\b(\d{6})\b/.exec(message.text)![1];
}

/**
 * Asks for a sign-in code.
 * @param agent - the browser.
 * @param email - the address.
 * @returns the response.
 */
function start(agent: TestAgent, email: string, purpose = "sign-in") {
  return agent.post("/api/auth/email/start").send({ email, purpose });
}

/**
 * Types a code.
 * @param agent - the browser.
 * @param email - the address.
 * @param code - the code.
 * @returns the response.
 */
function verify(agent: TestAgent, email: string, code: string, purpose = "sign-in", returnTo?: string) {
  return agent.post("/api/auth/email/verify").send({ email, code, purpose, returnTo });
}

/**
 * A code that differs from the right one.
 * @param code - the right code.
 * @returns a wrong one.
 */
function wrong(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

describe("Signing in with an email code", () => {
  it("an unknown address gets a code, and the code creates a new User on the welcome step", async () => {
    const agent = newAgent();
    expect((await start(agent, " Ann@Example.com ")).status).toBe(204);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "ann@example.com", subject: expect.stringContaining(codeSentTo("ann@example.com")) });

    const res = await verify(agent, "ann@example.com", codeSentTo("ann@example.com"), "sign-in", "/world/map");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ redirectTo: "/welcome" });
    expect((await agent.get("/api/me")).body.user).toMatchObject({ email: "ann@example.com", displayName: "" });
    expect(await prisma.signInMethod.findMany({ select: { kind: true, subject: true } })).toEqual([
      { kind: "email", subject: "ann@example.com" },
    ]);
  });

  it("a known address signs the same User in, and goes to the requested page after welcome", async () => {
    const first = newAgent();
    await start(first, "ann@example.com");
    await verify(first, "ann@example.com", codeSentTo("ann@example.com"));
    await first.post("/api/me/primary-person").send({ name: "Ann", colorHex: "#123456" });

    const second = newAgent();
    await start(second, "ANN@example.com");
    const res = await verify(second, "ann@example.com", codeSentTo("ann@example.com"), "sign-in", "/world/map");
    expect(res.body).toEqual({ redirectTo: "/world/map" });
    expect((await second.get("/api/me")).body.user.id).toBe((await first.get("/api/me")).body.user.id);
  });

  it("refuses a wrong code, and a code that's already been used", async () => {
    const agent = newAgent();
    await start(agent, "ann@example.com");
    const code = codeSentTo("ann@example.com");
    expect((await verify(agent, "ann@example.com", wrong(code))).body).toEqual({ error: EMAIL_CODE_FAILED_MESSAGE });
    expect((await verify(agent, "ann@example.com", code)).status).toBe(200);
    const reused = await verify(newAgent(), "ann@example.com", code);
    expect(reused.status).toBe(400);
    expect(reused.body).toEqual({ error: EMAIL_CODE_FAILED_MESSAGE });
  });

  it("refuses an expired code", async () => {
    await start(newAgent(), "ann@example.com");
    await prisma.emailCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await verify(newAgent(), "ann@example.com", codeSentTo("ann@example.com"))).status).toBe(400);
    expect(await prisma.emailCode.count()).toBe(0);
  });

  it("kills a code after 5 wrong guesses, even if the 6th is right", async () => {
    await start(newAgent(), "ann@example.com");
    const code = codeSentTo("ann@example.com");
    // Five wrong guesses use up every try.
    for (let i = 0; i < 5; i++) expect((await verify(newAgent(), "ann@example.com", wrong(code))).status).toBe(400);
    expect((await verify(newAgent(), "ann@example.com", code)).status).toBe(400);
  });

  it("only the newest code works", async () => {
    await start(newAgent(), "ann@example.com");
    const older = codeSentTo("ann@example.com");
    await start(newAgent(), "ann@example.com");
    const newer = codeSentTo("ann@example.com");
    // If the two random codes happen to match, the check below proves nothing; skip it then.
    if (older !== newer) expect((await verify(newAgent(), "ann@example.com", older)).status).toBe(400);
    expect((await verify(newAgent(), "ann@example.com", newer)).status).toBe(200);
  });

  it("answers start the same way for an address with an account and one without", async () => {
    await start(newAgent(), "known@example.com");
    await verify(newAgent(), "known@example.com", codeSentTo("known@example.com"));
    const known = await start(newAgent(), "known@example.com");
    const unknown = await start(newAgent(), "unknown@example.com");
    expect([known.status, known.text, known.headers["content-length"]]).toEqual([unknown.status, unknown.text, unknown.headers["content-length"]]);
  });

  it("refuses an address that isn't valid, and a malformed code", async () => {
    expect((await start(newAgent(), "not-an-email")).body).toEqual({ error: "Enter a valid email address." });
    expect((await verify(newAgent(), "ann@example.com", "12ab56")).body).toEqual({ error: EMAIL_CODE_FAILED_MESSAGE });
  });

  it("an email address and a Google account with the same email are two different Users", async () => {
    await prisma.user.create({
      data: { email: "ann@example.com", displayName: "Ann", signInMethods: { create: { kind: "google", subject: "g1", email: "ann@example.com" } } },
    });
    await start(newAgent(), "ann@example.com");
    await verify(newAgent(), "ann@example.com", codeSentTo("ann@example.com"));
    expect(await prisma.user.count()).toBe(2);
  });
});

describe("Email code rate limits", () => {
  it("sends at most 3 codes per address per 15 minutes, still answering 204", async () => {
    for (let i = 0; i < 4; i++) expect((await start(newAgent(), "ann@example.com")).status).toBe(204);
    expect(outbox).toHaveLength(3);
  });

  it("sends at most 10 codes per IP address per hour", async () => {
    for (let i = 0; i < 11; i++) expect((await start(newAgent(), `person${i}@example.com`)).status).toBe(204);
    expect(outbox).toHaveLength(10);
  });

  it("counts the visitor's address from Cloudflare's header when it's there", async () => {
    // Ten from one Cloudflare visitor use up their hour; another visitor is unaffected.
    for (let i = 0; i < 10; i++) await newAgent().post("/api/auth/email/start").set("CF-Connecting-IP", "203.0.113.1").send({ email: `a${i}@x.com`, purpose: "sign-in" });
    await newAgent().post("/api/auth/email/start").set("CF-Connecting-IP", "203.0.113.1").send({ email: "late@x.com", purpose: "sign-in" });
    await newAgent().post("/api/auth/email/start").set("CF-Connecting-IP", "203.0.113.2").send({ email: "other@x.com", purpose: "sign-in" });
    expect(outbox.map((message) => message.to)).not.toContain("late@x.com");
    expect(outbox.map((message) => message.to)).toContain("other@x.com");
  });
});

describe("Adding an email address", () => {
  it("adds the address to the signed-in account, which can then sign in with it", async () => {
    const agent = await signIn("alice");
    expect((await start(agent, "alice@mail.test", "add-email")).status).toBe(204);
    expect((await verify(agent, "alice@mail.test", codeSentTo("alice@mail.test"), "add-email")).status).toBe(204);

    const other = newAgent();
    await start(other, "alice@mail.test");
    await verify(other, "alice@mail.test", codeSentTo("alice@mail.test"));
    expect((await other.get("/api/me")).body.user.id).toBe((await agent.get("/api/me")).body.user.id);
  });

  it("sends nothing for an address on another account, and verify says it's taken", async () => {
    await start(newAgent(), "bob@mail.test");
    await verify(newAgent(), "bob@mail.test", codeSentTo("bob@mail.test"));
    outbox.length = 0;

    const alice = await signIn("alice");
    expect((await start(alice, "bob@mail.test", "add-email")).status).toBe(204);
    expect(outbox).toHaveLength(0);
    const res = await verify(alice, "bob@mail.test", "123456", "add-email");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: TAKEN_MESSAGE });
  });

  it("an add-email code works only for the account that asked for it", async () => {
    const alice = await signIn("alice");
    await start(alice, "shared@mail.test", "add-email");
    const bob = await signIn("bob");
    expect((await verify(bob, "shared@mail.test", codeSentTo("shared@mail.test"), "add-email")).status).toBe(400);
  });

  it("needs a signed-in User", async () => {
    expect((await start(newAgent(), "a@mail.test", "add-email")).status).toBe(401);
    expect((await verify(newAgent(), "a@mail.test", "123456", "add-email")).status).toBe(401);
  });
});

describe("Email codes off", () => {
  it("without a mail service the routes don't exist and /api/auth/methods says so", async () => {
    delete process.env.SMTP_HOST;
    expect((await start(newAgent(), "ann@example.com")).status).toBe(404);
    expect((await newAgent().get("/api/auth/methods")).body.emailCodes).toBe(false);
  });
});

describe("Delete account", () => {
  it("removes the User's email sign-in and pending add-email codes", async () => {
    const agent = await signIn("alice");
    await start(agent, "a1@mail.test", "add-email");
    await verify(agent, "a1@mail.test", codeSentTo("a1@mail.test"), "add-email");
    await start(agent, "a2@mail.test", "add-email");
    await agent.delete("/api/me");
    expect(await prisma.emailCode.count()).toBe(0);
    expect(await prisma.signInMethod.count()).toBe(0);
  });
});
