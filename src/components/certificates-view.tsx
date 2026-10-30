"use client";

// The learner's certificates (ADR-0029): what is earned, what is claimable now, and how far
// each part has to go. Claims are re-checked on the server.
import Link from "next/link";
import { useEffect, useState } from "react";
import { eligibilityFrom, type PartSpec, type Scope } from "@/lib/certificates";
import { Icon } from "./icons";
import { useLearner } from "./learner/provider";

interface Cert {
  id: string;
  course: string;
  scope: string;
  nameSnapshot: string;
  issuedAt: string;
}

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function CertificatesView({
  course,
  courseTitle,
  specs,
}: {
  course: string;
  courseTitle: string;
  specs: { parts: PartSpec[]; comingSoon: number };
}) {
  const { status, state, user, notify } = useLearner();
  const [certs, setCerts] = useState<Cert[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    fetch("/api/me/certificates")
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((b: { certificates: Cert[] }) => setCerts(b.certificates))
      .catch(() => setCerts([]));
  }, [status]);

  if (status === "loading" || (status === "ready" && certs === null))
    return <p className="muted">Loading your certificates…</p>;

  const e = eligibilityFrom(specs, state);
  const issued = new Map((certs ?? []).filter((c) => c.course === course).map((c) => [c.scope, c]));

  async function claim(scope: Scope) {
    setBusy(scope);
    setError(null);
    try {
      const res = await fetch("/api/me/certificates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ course, scope }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong. Try again.");
      setCerts((cs) => [
        body.certificate,
        ...(cs ?? []).filter((c) => c.id !== body.certificate.id),
      ]);
      notify("Certificate issued");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: Cert) {
    if (
      !window.confirm(
        "Delete this certificate? Its link will stop working. You can claim it again later.",
      )
    )
      return;
    const res = await fetch(`/api/me/certificates/${c.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (res.ok) setCerts((cs) => (cs ?? []).filter((x) => x.id !== c.id));
  }

  const issuedActions = (c: Cert) => (
    <div className="cert-row-actions">
      <Link className="btn small primary" href={`/certificates/${c.id}`}>
        View certificate
      </Link>
      <button
        type="button"
        className="btn small"
        onClick={async () => {
          await navigator.clipboard?.writeText(`${window.location.origin}/certificates/${c.id}`);
          notify("Link copied");
        }}
      >
        Copy link
      </button>
      <button type="button" className="btn small danger" onClick={() => remove(c)}>
        Delete
      </button>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p className="muted" style={{ margin: 0 }}>
        Earn a certificate for each part of {courseTitle}: finish every chapter in the part (read
        it, do the lab, answer the drill, rate the questions) and pass its checkpoint. Each
        certificate has a public link anyone can use to check it.
      </p>
      {status !== "ready" && (
        <p className="notice">
          <Link href="/sign-in?next=%2Fcertificates">Sign in</Link> to earn certificates.
        </p>
      )}
      {status === "ready" && !user?.name?.trim() && (
        <p className="notice">
          Your certificates will show your name. <Link href="/account">Add your name</Link> before
          you claim one.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul className="cert-list">
        {e.parts.map((p) => {
          const scope = `part:${p.part}` as Scope;
          const c = issued.get(scope);
          return (
            <li key={p.part} className="cert-row">
              <div className="cert-row-head">
                <span className={`cert-badge${c ? " earned" : ""}`} aria-hidden="true">
                  <Icon name={c ? "medal" : "flag"} />
                </span>
                <div>
                  <h2>
                    Part {p.part}: {p.title}
                  </h2>
                  <p className="muted small">
                    {c
                      ? `Issued ${date(c.issuedAt)} to ${c.nameSnapshot}`
                      : `${p.done} of ${p.total} chapters complete · checkpoint ${p.checkpointPassed ? "passed" : "not passed yet"}`}
                  </p>
                </div>
              </div>
              {c ? (
                issuedActions(c)
              ) : p.eligible ? (
                <button
                  type="button"
                  className="btn small primary"
                  disabled={busy === scope}
                  onClick={() => claim(scope)}
                >
                  Claim certificate
                </button>
              ) : (
                <Link className="btn small" href={`/learn/${course}`}>
                  Keep going
                </Link>
              )}
            </li>
          );
        })}
        <li className="cert-row">
          <div className="cert-row-head">
            <span
              className={`cert-badge${issued.get("course") ? " earned" : ""}`}
              aria-hidden="true"
            >
              <Icon name="star" />
            </span>
            <div>
              <h2>The whole course</h2>
              <p className="muted small">
                {issued.get("course")
                  ? `Issued ${date(issued.get("course")!.issuedAt)}`
                  : e.comingSoon > 0
                    ? `Available once every chapter is published (${e.comingSoon} still coming soon) and every part certificate is earned.`
                    : "Earn every part certificate to claim it."}
              </p>
            </div>
          </div>
          {issued.get("course") ? (
            issuedActions(issued.get("course")!)
          ) : e.courseEligible ? (
            <button type="button" className="btn small primary" onClick={() => claim("course")}>
              Claim certificate
            </button>
          ) : null}
        </li>
      </ul>
    </div>
  );
}
