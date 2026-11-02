import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { safeNext } from "@/lib/safe-next";
import { googleEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  // Only same-site paths are allowed as a post-sign-in destination (no open redirect).
  const destination = safeNext(next);
  return (
    <main id="main" className="wrap" style={{ paddingBlock: "40px 64px", maxWidth: "30rem" }}>
      <h1 style={{ fontSize: "2rem", margin: 0 }}>Sign in or create your free account</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Save your progress, earn XP, keep a streak and pick up where you left off on any device.
      </p>
      {error && (
        <p role="alert" className="card" style={{ marginTop: 16, borderColor: "var(--decide)" }}>
          That sign-in link has expired or was already used. Ask for a new one below.
        </p>
      )}
      <SignInForm next={destination} google={googleEnabled()} />
      <p className="muted small" style={{ marginTop: 24 }}>
        We only store your email, your name if you add one, and what you do in the course. No
        tracking cookies.
      </p>
    </main>
  );
}
