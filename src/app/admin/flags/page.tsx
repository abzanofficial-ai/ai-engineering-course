import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminFlags } from "@/components/admin-flags";
import { AdminNav } from "@/components/admin-nav";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Admin · Feature flags", robots: { index: false } };
export const dynamic = "force-dynamic";

// Platform owners only (ADR-0031). Everyone else gets "not found", so the page isn't advertised.
export default async function AdminFlagsPage() {
  const user = await getUser(await headers());
  if (!user) redirect("/sign-in?next=/admin/flags");
  if (user.platformRole !== "platform_owner") notFound();
  return (
    <main id="main" className="wrap panel-wrap admin">
      <AdminNav current="/admin/flags" />
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Feature flags</h1>
      <p className="muted" style={{ margin: 0 }}>
        Switch features on or off without a deploy. Changes reach every server within 30 seconds.
      </p>
      <AdminFlags />
    </main>
  );
}
