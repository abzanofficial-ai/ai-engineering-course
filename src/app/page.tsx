import { Dashboard } from "@/components/dashboard";
import { dashboardCourse } from "@/lib/dashboard-data";
import { defaultBranding as brand } from "@/lib/branding";
import { getManifest, listCourses } from "@/lib/content";

// The learner's home (ADR-0028). Lists every configured course; per-tenant course lists and
// entitlement filtering arrive with Phase 2 and M5 (ADR-0023, ADR-0010).
export default function Home() {
  const courses = listCourses().flatMap((c) => {
    const m = getManifest(c.slug);
    return m ? [dashboardCourse(c, m)] : [];
  });
  return <Dashboard courses={courses} providerCourse={brand.defaultCourse} intro={brand.tagline} />;
}
