import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HeaderNav, TabBar } from "@/components/app-nav";
import { AccountPrompt, HeaderStatus } from "@/components/header-status";
import { Icon } from "@/components/icons";
import { LearnerProvider } from "@/components/learner/provider";
import { Pwa } from "@/components/pwa";
import { ThemeToggle } from "@/components/theme-toggle";
import { defaultBranding as brand, markGradient } from "@/lib/branding";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

// Display face for headings and numbers only; self-hosted by next/font (design-system §5.5).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-display",
  display: "swap",
});

// Static pages are built before any request, so they carry the default tenant's branding
// (ADR-0024); per-host branding of static pages is Phase 2.
export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
  icons: { icon: brand.logo.icon192, apple: brand.logo.appleTouch },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.colors.themeLight },
    { media: "(prefers-color-scheme: dark)", color: brand.colors.themeDark },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const course = brand.defaultCourse;
  return (
    <html
      lang="en-GB"
      className={display.variable}
      style={{ "--brand-mark": markGradient(brand) } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <LearnerProvider course={course}>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <header className="bar">
            <div className="wrap">
              <Link href="/" className="brand">
                <span className="mark" aria-hidden="true" />
                <span>{brand.headerName}</span>
              </Link>
              <HeaderNav course={course} />
              <HeaderStatus />
              <Link
                className="icon-btn"
                href="/search"
                aria-label="Search the course"
                title="Search"
              >
                <Icon name="search" />
              </Link>
              <ThemeToggle />
            </div>
          </header>
          {children}
          <footer className="mt-16 border-t border-line py-8 text-sm text-muted">
            <div className="wrap flex flex-wrap gap-x-6 gap-y-2" style={{ maxWidth: "72rem" }}>
              <span>{brand.footer}</span>
              <Link href="/account">Account</Link>
              <a href={`mailto:${brand.supportEmail}`}>Contact support</a>
            </div>
          </footer>
          <TabBar course={course} />
          <AccountPrompt />
          <Pwa />
        </LearnerProvider>
      </body>
    </html>
  );
}
