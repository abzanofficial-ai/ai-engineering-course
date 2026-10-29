import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "The AI Engineering Handbook", template: "%s · The AI Engineering Handbook" },
  description: "A practical course that takes you from beginner to job-ready AI engineer.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="sticky top-0 z-40 h-14 border-b border-hairline bg-bg/95 backdrop-blur">
          <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4">
            <Link href="/" className="font-bold text-text no-underline">
              <span aria-hidden="true">◆ </span>AI Engineering Handbook
            </Link>
            <nav aria-label="Site" className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-16 border-t border-hairline py-8 text-sm text-muted">
          <div className="mx-auto max-w-7xl px-4">The AI Engineering Handbook</div>
        </footer>
      </body>
    </html>
  );
}
