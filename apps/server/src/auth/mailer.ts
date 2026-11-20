import nodemailer from "nodemailer";
import { isE2eFakeAuthEnabled } from "./e2eFakeAuth.js";

// Sends the app's only email: the Email code. Plain SMTP through nodemailer, so any mail service
// works (Bob picks one at deploy time; see MAIL_SETTINGS in config.ts). During E2E runs nothing is
// sent: messages go to an in-memory outbox the tests read through the fake sign-in routes. Unit tests
// replace this whole module (tests/setup.ts).

/** One outgoing email. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Messages "sent" during an E2E run, newest last. Never used outside E2E runs. */
export const outbox: MailMessage[] = [];

/** How many outbox messages to keep; an E2E run sends a handful, this just bounds memory. */
const OUTBOX_LIMIT = 200;

/**
 * Sends one email through the configured SMTP server (or, during E2E runs, the outbox).
 * @param message - who to, subject and plain-text body.
 * @throws if the mail server refuses or can't be reached.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  // E2E runs never send real mail.
  if (isE2eFakeAuthEnabled()) {
    outbox.push(message);
    // Drop the oldest once full (a long-running E2E server shouldn't grow without limit).
    if (outbox.length > OUTBOX_LIMIT) outbox.shift();
    return;
  }

  const port = Number(process.env.SMTP_PORT);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 speaks TLS from the first byte; 587 (and 25) start plain and upgrade with STARTTLS.
    secure: port === 465,
    // Never send the password over an unencrypted connection: STARTTLS is required, not optional.
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM, ...message });
}

/**
 * The email that carries an Email code.
 * @param to - the address the code proves.
 * @param code - the 6-digit code.
 * @returns the message.
 */
export function emailCodeMessage(to: string, code: string): MailMessage {
  return {
    to,
    subject: `Your FamilyPassportMap code: ${code}`,
    text: [
      `Your FamilyPassportMap code is ${code}.`,
      "",
      "Type it on the page that asked for it. It works for 10 minutes, and only once.",
      "",
      "If you didn't ask for this, ignore this email. Nobody can sign in without the code.",
    ].join("\n"),
  };
}
