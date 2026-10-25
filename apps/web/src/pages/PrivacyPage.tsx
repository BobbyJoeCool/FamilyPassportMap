import type { ReactNode } from "react";

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
 * URL is the privacy-policy link on the Microsoft app registration's branding page.
 */
export function PrivacyPage() {
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Privacy</h1>

      <Section title="What we store">
        <p>When you sign in with Microsoft, we store the name and email address on your Microsoft account.</p>
        <p>We also store what you add: the People you track (each with a name, a color, and an optional photo) and the US states and countries each of them has visited.</p>
      </Section>

      <Section title="Who can see it">
        <p>Only you, while you're signed in. Other people using the app can't see your People, your maps, or your photos.</p>
      </Section>

      <Section title="Photos">
        <p>Photos you upload are shrunk to a small square picture when you upload them. The original full-size file isn't kept.</p>
      </Section>

      <Section title="Signing in">
        <p>Microsoft is used only to sign you in. We never see your Microsoft password, and we don't read anything else from your Microsoft account.</p>
        <p>A cookie keeps you signed in on this device until you sign out or haven't used the app for 30 days.</p>
      </Section>

      <Section title="Deleting your data">
        <p>Choose <strong>Delete account</strong> from the account menu to permanently delete your account and everything in it: all your People, their visits, and their photos. This can't be undone.</p>
      </Section>
    </article>
  );
}
