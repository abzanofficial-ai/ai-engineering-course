import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccessSummary } from "@/components/access-summary";
import { AccountForms } from "@/components/account-forms";
import { defaultBranding } from "@/lib/branding";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getUser(await headers());
  if (!user) redirect("/sign-in?next=/account");
  return (
    <main
      id="main"
      className="wrap"
      style={{ paddingBlock: "32px 64px", display: "grid", gap: 18 }}
    >
      <h1 style={{ fontSize: "2rem", margin: 0 }}>Your account</h1>
      <AccessSummary course={defaultBranding.defaultCourse} />
      <AccountForms name={user.name} email={user.email} />
    </main>
  );
}
