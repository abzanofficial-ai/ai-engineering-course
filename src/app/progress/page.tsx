import type { Metadata } from "next";
import { ProgressView } from "@/components/progress-view";
import { getManifest, listCourses } from "@/lib/content";
import { routeData } from "@/lib/route-data";

export const metadata: Metadata = { title: "Your progress" };

export default function ProgressPage() {
  const course = listCourses()[0]!.slug;
  return (
    <main id="main">
      <ProgressView data={routeData(course, getManifest(course)!)} />
    </main>
  );
}
