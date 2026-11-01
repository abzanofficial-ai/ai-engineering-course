import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteView } from "@/components/route-view";
import { getManifest, listCourses } from "@/lib/content";
import { routeData } from "@/lib/route-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return listCourses().map((c) => ({ course: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string }>;
}): Promise<Metadata> {
  const { course } = await params;
  return { title: getManifest(course)?.title ?? "Course" };
}

export default async function CourseHome({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  const manifest = getManifest(course);
  if (!manifest) notFound();
  return (
    <main id="main">
      <RouteView data={routeData(course, manifest)} />
    </main>
  );
}
