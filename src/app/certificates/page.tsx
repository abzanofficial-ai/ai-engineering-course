import type { Metadata } from "next";
import Link from "next/link";
import { CertificatesView } from "@/components/certificates-view";
import { Icon } from "@/components/icons";
import { defaultBranding } from "@/lib/branding";
import { certificateParts } from "@/lib/certificates";
import { getManifest } from "@/lib/content";

export const metadata: Metadata = { title: "Certificates" };

export default function CertificatesRoute() {
  const course = defaultBranding.defaultCourse;
  const manifest = getManifest(course)!;
  return (
    <main id="main">
      <div className="wrap panel-wrap">
        <Link className="back" href="/home">
          <Icon name="back" /> Home
        </Link>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Certificates</h1>
        <CertificatesView
          course={course}
          courseTitle={manifest.title}
          specs={certificateParts(manifest)}
        />
      </div>
    </main>
  );
}
