import { redirect } from "next/navigation";
import { listCourses } from "@/lib/content";

// One course today; the platform supports several (ADR-0017). With one, go straight to it.
export default function Home() {
  const courses = listCourses();
  redirect(`/learn/${courses[0]!.slug}`);
}
