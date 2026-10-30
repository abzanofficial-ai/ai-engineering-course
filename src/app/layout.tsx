import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountPrompt, HeaderStatus } from "@/components/header-status";
import { LearnerProvider } from "@/components/learner/provider";
import { Pwa } from "@/components/pwa";
import { ThemeToggle } from "@/components/theme-toggle";
import { listCourses } from "@/lib/content";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

// Display face for headings and numbers only; self-hosted by next/font (design-system §5.5).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "The AI Engineering Handbook", template: "%s · The AI Engineering Handbook" },
  description: "A practical route from beginner to job-ready AI engineer.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AI Handbook", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const course = listCourses()[0]!.slug;
  return (
    <html lang="en-GB" className={display.variable} suppressHydrationWarning>
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
              <Link href={`/learn/${course}`} className="brand">
                <span className="mark" aria-hidden="true" />
                <span>AI Engineering Handbook</span>
              </Link>
              <HeaderStatus />
              <ThemeToggle />
            </div>
          </header>
          {children}
          <footer className="mt-16 border-t border-line py-8 text-sm text-muted">
            <div className="wrap flex flex-wrap gap-x-6 gap-y-2" style={{ maxWidth: "72rem" }}>
              <span>The AI Engineering Handbook</span>
              <Link href="/account">Account</Link>
            </div>
          </footer>
          <AccountPrompt />
          <Pwa />
        </LearnerProvider>
      </body>
    </html>
  );
}
