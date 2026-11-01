import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { JoinForm } from "@/components/join-form";
import { defaultBranding } from "@/lib/branding";

export const metadata: Metadata = { title: "Join with a code" };

export default function JoinPage() {
  return (
    <main id="main" className="wrap panel-wrap" style={{ maxWidth: "36rem" }}>
      <Link className="back" href="/home">
        <Icon name="back" /> Home
      </Link>
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Join with a code</h1>
      <p className="muted" style={{ margin: 0 }}>
        Your training centre gives you a code with your place on the course. Enter it once; it is
        linked to this account.
      </p>
      <JoinForm course={defaultBranding.defaultCourse} />
    </main>
  );
}
