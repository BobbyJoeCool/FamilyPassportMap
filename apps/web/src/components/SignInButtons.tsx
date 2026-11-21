import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Provider } from "@familypassportmap/shared";
import googleLogoDark from "../assets/sign-in/google-g-dark.png";
import googleLogoLight from "../assets/sign-in/google-g-light.png";

// Sign-in buttons dressed as the service they use, so people recognise "their" button at a glance.
// Each provider's look follows its own branding rules:
// - Google: "Sign in with Google" branding guidelines (light #FFFFFF / #747775 border / #1F1F1F text;
//   dark #131314 / #8E918F border / #E3E3E3 text). The standard-color G is cropped from Google's
//   official sign-in asset bundle, one copy per theme, since Google doesn't allow a homemade G.
// - Microsoft: "Sign in with Microsoft" branding guidelines (light #FFFFFF / #8C8C8C border /
//   #5E5E5E text; dark #2F2F2F / white text) with the four-square Microsoft logo.
// - GitHub: no button guideline exists, so GitHub's own dark UI color with its official mark (from
//   GitHub's Primer icon set).
// The passkey icon is our own drawing: Apple's Keychain icon is Apple's trademark, and the FIDO
// Alliance passkey icon needs its usage agreement signed first.

/** The layout every sign-in button shares: full width, logo then label, 40px tall. */
const BASE =
  "flex w-full h-10 items-center justify-center gap-2.5 px-3 rounded border text-sm font-medium transition-[filter] hover:brightness-95 dark:hover:brightness-110 disabled:opacity-50";

/** Each provider's colors, light and dark (the app follows the system's color scheme). */
const PROVIDER_STYLES: Record<Provider, string> = {
  google: "bg-white border-[#747775] text-[#1F1F1F] dark:bg-[#131314] dark:border-[#8E918F] dark:text-[#E3E3E3]",
  microsoft:
    "bg-white border-[#8C8C8C] text-[#5E5E5E] dark:bg-[#2F2F2F] dark:border-[#2F2F2F] dark:text-white [font-family:'Segoe_UI',system-ui,sans-serif] font-semibold",
  github: "bg-[#24292F] border-[#24292F] text-white dark:border-[#3D444D]",
};

/**
 * Google's standard-color G, switching to the dark-theme copy when the system is in dark mode.
 * @returns the logo, hidden from screen readers (the button's text already names Google).
 */
function GoogleLogo() {
  return (
    <picture className="shrink-0">
      <source srcSet={googleLogoDark} media="(prefers-color-scheme: dark)" />
      <img src={googleLogoLight} alt="" aria-hidden="true" width={20} height={20} />
    </picture>
  );
}

/**
 * Microsoft's four-square logo, from Microsoft's branding page.
 * @returns the logo, hidden from screen readers.
 */
function MicrosoftLogo() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 21 21" className="shrink-0">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

/**
 * GitHub's mark (the Octocat silhouette), in the button's text color.
 * @returns the logo, hidden from screen readers.
 */
function GitHubLogo() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943" />
    </svg>
  );
}

/** Each provider's logo component. */
const PROVIDER_LOGOS: Record<Provider, () => ReactNode> = {
  google: GoogleLogo,
  microsoft: MicrosoftLogo,
  github: GitHubLogo,
};

/**
 * A key with a person-shaped bow, standing for a passkey (drawn for this app).
 * @returns the icon, hidden from screen readers.
 */
export function PasskeyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {/* A person: head and shoulders. */}
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2.5 20v-1.5A5.5 5.5 0 0 1 8 13h2" />
      {/* A key: round bow, shaft, and two teeth. */}
      <circle cx="16.5" cy="11.5" r="2.5" />
      <path d="M16.5 14v7M16.5 18h2M16.5 20.5h2.5" />
    </svg>
  );
}

/**
 * A link that starts a round trip through a provider, styled as that provider's button.
 * @param props.provider - which provider.
 * @param props.href - the server URL that starts the round trip.
 * @param props.children - the label, e.g. "Continue with Google" or "Add Google".
 * @returns the branded link.
 */
export function ProviderButton({ provider, href, children }: { provider: Provider; href: string; children: ReactNode }) {
  const Logo = PROVIDER_LOGOS[provider];
  return (
    <a href={href} className={`${BASE} ${PROVIDER_STYLES[provider]}`}>
      <Logo />
      <span>{children}</span>
    </a>
  );
}

/**
 * A button for a passkey action, in the app's own colors with the passkey icon.
 * @param props.children - the label.
 * @param props - any other button attributes (onClick, disabled, type…).
 * @returns the button.
 */
export function PasskeyButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`${BASE} bg-[var(--color-primary)] border-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] ${className}`}
    >
      <PasskeyIcon />
      <span>{children}</span>
    </button>
  );
}
