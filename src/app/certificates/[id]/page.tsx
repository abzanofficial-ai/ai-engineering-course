import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { brandingFor } from "@/lib/branding";
import { scopeLabel } from "@/lib/certificates";
import { getManifest } from "@/lib/content";
import { verifyCertificate } from "@/server/repo/certificate";
import { getTenant } from "@/server/repo/tenant";

// Public verification of a certificate by its unguessable id (ADR-0029). Shows only what the
// certificate itself shows; unknown or deleted ids are 404.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificate",
  robots: { index: false, follow: false },
};

const date = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await verifyCertificate(id);
  const manifest = cert && getManifest(cert.course);
  if (!cert || !manifest) notFound();
  const brand = brandingFor((await getTenant(cert.tenantId)).config);
  const scope = scopeLabel(manifest, cert.scope);

  return (
    <main id="main" className="wrap cert-wrap">
      <article className="cert" aria-labelledby="cert-title">
        <div className="cert-mark" aria-hidden="true" />
        <p className="cert-kicker">{brand.certificate.title}</p>
        <h1 id="cert-title" className="cert-name">
          {cert.name}
        </h1>
        <p className="cert-body">{brand.certificate.body.replace("{scope}", scope)}</p>
        <dl className="cert-meta">
          <div>
            <dt>Course</dt>
            <dd>{manifest.title}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{scope}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{date(cert.issuedAt)}</dd>
          </div>
        </dl>
        <p className="cert-sign">{brand.certificate.signatory}</p>
      </article>
      <p className="cert-verified" role="note">
        Verified: this certificate was issued by {brand.certificate.signatory} on{" "}
        {date(cert.issuedAt)}. Certificate ID <code>{cert.id}</code>.
      </p>
      <PrintButton />
    </main>
  );
}
