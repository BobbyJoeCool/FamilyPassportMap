import { useState } from "react";
import { DEFAULT_LANDING_PATH } from "@familypassportmap/shared";
import { createPrimaryPerson } from "../api/auth";

const DEFAULT_COLOR = "#3366cc";

/**
 * The one-time welcome step after a User's first sign-in: confirm their name (prefilled from
 * Google) and choose their color, which creates their Primary Person.
 * @param suggestedName - the name from their Google account.
 */
export function WelcomePage({ suggestedName }: { suggestedName: string }) {
  const [name, setName] = useState(suggestedName);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [colorChosen, setColorChosen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; color?: string; submit?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  /**
   * Validates the form, creates the Primary Person, then reloads into the app so the new
   * Primary Person is picked up everywhere.
   * @param event - the form submit event.
   */
  async function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    // Same rules as adding any Person: a name, and a color the User actually picked.
    if (!name.trim()) found.name = "Name is required.";
    if (!colorChosen) found.color = "Please choose a color.";
    setErrors(found);
    // Anything wrong: show it and stay on the form.
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await createPrimaryPerson({ name: name.trim(), colorHex: color });
      window.location.assign(DEFAULT_LANDING_PATH);
    } catch (error) {
      setSubmitting(false);
      setErrors({ submit: error instanceof Error ? error.message : "Couldn't save. Please try again." });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleContinue}
        className="w-full max-w-sm p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]"
      >
        <h1 className="text-2xl font-bold text-[var(--color-text-heading)] mb-2">Welcome!</h1>
        <p className="text-[var(--color-text-muted)] mb-6">
          First, add yourself. Your color marks the places you've been on every map.
        </p>

        <label className="flex flex-col gap-1 text-sm font-medium mb-4">
          Your name
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            className={`px-3 py-2 rounded-md border bg-[var(--color-bg)] text-[var(--color-text)] text-base ${errors.name ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
          />
          {errors.name && <span className="text-xs text-[var(--color-danger)]">{errors.name}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium mb-6">
          Your color
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setColorChosen(true);
              setErrors((prev) => ({ ...prev, color: undefined }));
            }}
            className={`w-10 h-10 rounded cursor-pointer border ${errors.color ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
          />
          {errors.color && <span className="text-xs text-[var(--color-danger)]">{errors.color}</span>}
        </label>

        {/* Only after the server refused or couldn't be reached. */}
        {errors.submit && (
          <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
            {errors.submit}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium disabled:opacity-50 transition-colors"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
