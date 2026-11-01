import type { Metadata } from "next";
import { ProgressView } from "@/components/progress-view";
import { defaultBranding } from "@/lib/branding";
import { getManifest } from "@/lib/content";
import { routeData } from "@/lib/route-data";

export const metadata: Metadata = { title: "Your progress" };

export default function ProgressPage() {
  const course = defaultBranding.defaultCourse;
  return (
    <main id="main">
      <ProgressView data={routeData(course, getManifest(course)!)} />
    </main>
  );
}
