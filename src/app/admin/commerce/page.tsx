import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminCommerce } from "@/components/admin-commerce";
import { AdminNav } from "@/components/admin-nav";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Admin · Access and centres", robots: { index: false } };
export const dynamic = "force-dynamic";

// Platform owners only (ADR-0030). Everyone else gets "not found", so the page isn't advertised.
export default async function AdminCommercePage() {
  const user = await getUser(await headers());
  if (!user) redirect("/sign-in?next=/admin/commerce");
  if (user.platformRole !== "platform_owner") notFound();
  return (
    <main id="main" className="wrap panel-wrap admin">
      <AdminNav current="/admin/commerce" />
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Access and centres</h1>
      <p className="muted" style={{ margin: 0 }}>
        Seat packs, manual access and centre licences (ADR-0030). Prices default to
        content/plans.json.
      </p>
      <AdminCommerce />
    </main>
  );
}
