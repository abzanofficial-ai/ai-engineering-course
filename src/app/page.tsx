import { redirect } from "next/navigation";
import { defaultBranding } from "@/lib/branding";

// The tenant's default course (ADR-0024); the platform can host several (ADR-0017).
export default function Home() {
  redirect(`/learn/${defaultBranding.defaultCourse}`);
}
