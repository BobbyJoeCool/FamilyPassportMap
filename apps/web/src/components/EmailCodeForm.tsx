import { useState, type FormEvent } from "react";

/**
 * The two-step Email code form: type an address and get a code, then type the 6-digit code. Used to
 * sign in on the sign-in page and to add an address on the Sign-in methods page; the caller supplies
 * what "send" and "verify" do.
 * @param sendLabel - the first step's button ("Email me a code").
 * @param verifyLabel - the second step's button ("Sign in", "Add email").
 * @param onSend - asks the server for a code; throws with a message for an invalid address.
 * @param onVerify - checks the code; throws with a message when it's wrong.
 */
export function EmailCodeForm({
  sendLabel,
  verifyLabel,
  onSend,
  onVerify,
}: {
  sendLabel: string;
  verifyLabel: string;
  onSend: (email: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Runs one server call with the busy flag and error message handled.
   * @param action - the call.
   */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * First step: send a code, then show the code field.
   * @param event - the form submit.
   */
  function handleSend(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await onSend(email);
      setStep("code");
      setCode("");
      setNotice(`If ${email.trim()} can receive email, a code is on its way. It works for 10 minutes.`);
    });
  }

  /**
   * Second step: check the code.
   * @param event - the form submit.
   */
  function handleVerify(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await onVerify(email, code);
      // Done: back to an empty first step (the sign-in page navigates away; adding stays here).
      setStep("email");
      setEmail("");
      setCode("");
      setNotice(null);
    });
  }

  /** Sends a fresh code to the same address (any earlier code stops working). */
  function handleResend() {
    void run(async () => {
      await onSend(email);
      setCode("");
      setNotice("A new code is on its way. Only the newest code works.");
    });
  }

  /** Goes back to the first step to type a different address. */
  function handleDifferentEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setNotice(null);
  }

  const inputClass =
    "w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-base";
  const buttonClass =
    "w-full px-4 py-2 rounded-lg border border-[var(--color-border)] font-medium hover:bg-[var(--color-bg)] disabled:opacity-50 transition-colors";

  return (
    <div className="text-left">
      {/* Step one asks for the address; step two for the code sent to it. */}
      {step === "email" ? (
        <form onSubmit={handleSend} className="space-y-2">
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Sending…" : sendLabel}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-2">
          {notice && <p className="text-sm text-[var(--color-text-muted)]">{notice}</p>}
          <label className="block text-sm font-medium">
            6-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className={`mt-1 tracking-widest ${inputClass}`}
            />
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Checking…" : verifyLabel}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={handleResend} disabled={busy} className="underline text-[var(--color-text-muted)]">
              Send a new code
            </button>
            <button type="button" onClick={handleDifferentEmail} disabled={busy} className="underline text-[var(--color-text-muted)]">
              Use a different email
            </button>
          </div>
        </form>
      )}
      {/* The server's message for a bad address or code. */}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
