"use client";

// "Your access" on the Account page (ADR-0030).
import Link from "next/link";
import { useEffect, useState } from "react";

interface Access {
  via: { allowed: true; via: string } | { allowed: false; reason: string };
  entitlements: {
    id: string;
    source: string;
    plan: string | null;
    orgName: string | null;
    endsAt: string | null;
  }[];
}

const until = (d: string | null) =>
  d
    ? ` until ${new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "";

export function AccessSummary({ course }: { course: string }) {
  const [a, setA] = useState<Access | null>(null);
  useEffect(() => {
    fetch(`/api/me/access?course=${encodeURIComponent(course)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setA)
      .catch(() => {});
  }, [course]);
  if (!a) return null;
  const line = (e: Access["entitlements"][number]) =>
    e.source === "seat"
      ? `A place from ${e.orgName ?? "your training centre"}${until(e.endsAt)}`
      : e.source === "direct"
        ? `Your ${e.plan ?? "plan"}${until(e.endsAt)}`
        : `Access granted by the team${until(e.endsAt)}`;
  return (
    <section className="card" aria-labelledby="access-h" style={{ display: "grid", gap: 8 }}>
      <h2 id="access-h" style={{ margin: 0, fontSize: "1.25rem" }}>
        Your access
      </h2>
      {a.via.allowed && a.via.via === "launch" && (
        <p style={{ margin: 0 }}>You have the full course free while we launch.</p>
      )}
      {a.via.allowed && a.via.via === "licence" && (
        <p style={{ margin: 0 }}>Your training centre&apos;s licence gives you the full course.</p>
      )}
      {a.entitlements.map((e) => (
        <p key={e.id} style={{ margin: 0 }}>
          {line(e)}.
        </p>
      ))}
      {!a.via.allowed && (
        <p style={{ margin: 0 }}>
          You have the free part of the course. <Link href="/plans">See plans</Link>.
        </p>
      )}
      <p className="small" style={{ margin: 0 }}>
        Have a code from a training centre? <Link href="/join">Join with a code</Link>.
      </p>
    </section>
  );
}
