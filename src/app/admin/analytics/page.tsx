import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminAnalytics } from "@/components/admin-analytics";
import { AdminNav } from "@/components/admin-nav";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Admin · Analytics", robots: { index: false } };
export const dynamic = "force-dynamic";

// Platform owners only (ADR-0032). Everyone else gets "not found", so the page isn't advertised.
export default async function AdminAnalyticsPage() {
  const user = await getUser(await headers());
  if (!user) redirect("/sign-in?next=/admin/analytics");
  if (user.platformRole !== "platform_owner") notFound();
  return (
    <main id="main" className="wrap panel-wrap admin">
      <AdminNav current="/admin/analytics" />
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Analytics</h1>
      <p className="muted" style={{ margin: 0 }}>
        Totals only, without cookies: where visitors and new learners come from, and how learners
        move through the course. Tag your links with <code>utm_source</code>,{" "}
        <code>utm_medium</code> and <code>utm_campaign</code> to see each post or ad separately.
      </p>
      <AdminAnalytics />
    </main>
  );
}
