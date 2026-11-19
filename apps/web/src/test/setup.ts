import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no <dialog> modal support. These stand-ins open and close the dialog the way a
// browser does, which is all DeleteAccountDialog needs.
if (!HTMLDialogElement.prototype.showModal) {
  /** Opens the dialog, as a browser's showModal would (without the focus trap). */
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  /** Closes the dialog. */
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

// Every test starts with a fresh DOM, fresh mocks and the real fetch.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
