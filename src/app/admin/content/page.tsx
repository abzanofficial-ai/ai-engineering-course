import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminContent } from "@/components/admin-content";
import { AdminNav } from "@/components/admin-nav";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Admin · Content", robots: { index: false } };
export const dynamic = "force-dynamic";

// Platform owners only (ADR-0006). Everyone else gets "not found".
export default async function AdminContentPage() {
  const user = await getUser(await headers());
  if (!user) redirect("/sign-in?next=/admin/content");
  if (user.platformRole !== "platform_owner") notFound();
  return (
    <main id="main" className="wrap panel-wrap admin">
      <AdminNav current="/admin/content" />
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Content</h1>
      <p className="muted" style={{ margin: 0 }}>
        Upload a new export of the handbook to see exactly what would change, then publish it.
        Publishing commits the file to the repository; the site rebuilds in a few minutes.
      </p>
      <AdminContent />
    </main>
  );
}
