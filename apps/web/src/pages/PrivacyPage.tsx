import type { ReactNode } from "react";
import { isDemo } from "../demoMode";

/**
 * One titled section of the privacy page.
 * @param title - the section heading.
 * @param children - the section's body text.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-heading)] mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/**
 * The public privacy page: a plain-language summary of what the app stores, who can see it,
 * and how to delete it. Reachable without signing in (linked from the sign-in page), and its
 * URL is the privacy-policy link registered with Microsoft, Google and GitHub. The guest demo
 * shows a short notice instead, since nothing leaves the browser there.
 */
export function PrivacyPage() {
  // The guest demo stores nothing anywhere, so it has its own short notice instead.
  if (isDemo()) {
    return (
      <article className="max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Privacy</h1>
        <Section title="This is the guest demo">
          <p>Everything in the demo happens in your browser. Nothing you type or upload leaves it: there's no account, no server and no tracking, and the demo sets no cookies.</p>
          <p>Your changes and any photos you add stay in this tab only. Reloading the page or closing the tab throws them away and starts over with the sample family.</p>
        </Section>
      </article>
    );
  }

  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Privacy</h1>

      <Section title="What we store">
        <p>For each way you sign in, we store only what's needed to recognize it:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Microsoft, Google or GitHub:</strong> that account's id, name and email address, and (Google and GitHub) the address of its profile picture, shown in the header.</li>
          <li><strong>Passkey:</strong> its public key and the name you gave it. The private key never leaves your device; we can't sign in as you with what we store.</li>
        </ul>
        <p>We also store what you add: the People you track (each with a name, a color, and an optional photo) and the US states and countries each of them has visited.</p>
      </Section>

      <Section title="Who can see it">
        <p>Only you, while you're signed in. Other people using the app can't see your People, your maps, or your photos.</p>
      </Section>

      <Section title="Photos">
        <p>Photos you upload are shrunk to a small square picture when you upload them. The original full-size file isn't kept.</p>
      </Section>

      <Section title="Signing in">
        <p>Microsoft, Google and GitHub are used only to sign you in. We never see your password there, and we don't read anything else from those accounts.</p>
        <p>A cookie keeps you signed in on this device until you sign out or haven't used the app for 30 days.</p>
        <p>You can see and remove your sign-in methods under <strong>Sign-in methods</strong> in the account menu. Removing one deletes what we stored for it.</p>
      </Section>

      <Section title="Deleting your data">
        <p>Choose <strong>Delete account</strong> from the account menu to permanently delete your account and everything in it: all your People, their visits, their photos, and every sign-in method. This can't be undone.</p>
      </Section>
    </article>
  );
}
