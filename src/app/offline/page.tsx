import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "You're offline" };

export default function Offline() {
  return (
    <main id="main" className="wrap" style={{ paddingBlock: "48px 64px", maxWidth: "32rem" }}>
      <h1 style={{ fontSize: "2rem", margin: 0 }}>You&apos;re offline</h1>
      <p>
        This page hasn&apos;t been saved on this device yet. Chapters you have opened before still
        work offline, and anything you tick or write is saved and synced when you reconnect.
      </p>
      <Link className="btn" href="/">
        Back to your route
      </Link>
    </main>
  );
}
