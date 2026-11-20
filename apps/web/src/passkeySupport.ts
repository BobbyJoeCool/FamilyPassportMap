import { browserSupportsWebAuthn } from "@simplewebauthn/browser";

/**
 * Whether this browser can use passkeys here: it supports WebAuthn and the page is a secure context
 * (https, or localhost). Kept in its own module so tests can switch it.
 * @returns true when passkey buttons should show.
 */
export function canUsePasskeys(): boolean {
  return window.isSecureContext && browserSupportsWebAuthn();
}

/**
 * A friendly message for a failed passkey attempt. The browser reports a cancelled or timed-out
 * prompt as a NotAllowedError; anything else carries the server's message.
 * @param error - what was thrown.
 * @returns the message to show.
 */
export function passkeyErrorMessage(error: unknown): string {
  // The visitor closed the device's prompt, or it timed out.
  if (error instanceof Error && error.name === "NotAllowedError") return "The passkey prompt was closed. Try again when you're ready.";
  return error instanceof Error ? error.message : "That passkey didn't work. Try again.";
}
