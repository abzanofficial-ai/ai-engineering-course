"use client";

// Preview and publish a new handbook export (ADR-0006).
import { useEffect, useState } from "react";

interface Ref {
  key: string;
  title: string;
}
interface Preview {
  hash: string;
  summary: {
    parts: number;
    published: number;
    comingSoon: number;
    questions: number;
    terms: number;
  };
  diff: {
    identical: boolean;
    addedPages: Ref[];
    removedPages: Ref[];
    nowPublished: Ref[];
    nowComingSoon: Ref[];
    renamedSlugs: { key: string; from: string; to: string }[];
    changedPages: {
      key: string;
      title: string;
      changedSections: string[];
      addedSections: string[];
      removedSections: string[];
      addedSteps: string[];
      removedSteps: string[];
      addedCards: number;
      removedCards: number;
    }[];
    removedKeys: { pageKey: string; kind: string; key: string }[];
    warnings: string[];
  };
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  if (!items.length) return null;
  return (
    <section className={`diff-group${tone ? ` diff-${tone}` : ""}`}>
      <h3>
        {title} <span className="muted">({items.length})</span>
      </h3>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

export function AdminContent() {
  const [status, setStatus] = useState<{
    courses: { slug: string; source: string }[];
    publishing: { repo: string; branch: string } | null;
  } | null>(null);
  const [course, setCourse] = useState("");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; steps?: string[] } | null>(null);
  const [ack, setAck] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<{ commitUrl: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/content")
      .then((r) => r.json())
      .then((b) => {
        setStatus(b);
        setCourse(b.courses?.[0]?.slug ?? "");
      })
      .catch(() => {});
  }, []);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError({ text: json.error ?? "That didn't work.", steps: json.instructions });
        return null;
      }
      return json;
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="muted">Loading…</p>;
  const d = preview?.diff;
  const p = (r: Ref) => `${r.title} (${r.key})`;

  return (
    <div className="admin-grid">
      <section className="panel" aria-labelledby="upload-h">
        <h2 id="upload-h">1. Upload the new export</h2>
        <div className="admin-form">
          <label>
            Course
            <select className="field" value={course} onChange={(e) => setCourse(e.target.value)}>
              {status.courses.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.slug}
                </option>
              ))}
            </select>
          </label>
          <label>
            Handbook file (.md)
            <input
              className="field"
              type="file"
              accept=".md,text/markdown,text/plain"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setPreview(null);
                setDone(null);
                setAck(false);
                setError(null);
                setFile(f ? { name: f.name, text: await f.text() } : null);
              }}
            />
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={!file || busy}
            onClick={async () => {
              const r = await post({ action: "preview", course, markdown: file!.text });
              if (r) setPreview(r);
            }}
          >
            {busy && !preview ? "Checking…" : "Preview changes"}
          </button>
        </div>
      </section>

      {error && (
        <div className="error" role="alert">
          <p style={{ margin: 0 }}>{error.text}</p>
          {error.steps && (
            <ol>
              {error.steps.map((s) => (
                <li key={s}>
                  <code>{s}</code>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {preview && d && (
        <section className="panel" aria-labelledby="diff-h">
          <h2 id="diff-h">2. What would change</h2>
          <p style={{ margin: 0 }}>
            {file?.name}: {preview.summary.published} pages published, {preview.summary.comingSoon}{" "}
            coming soon, {preview.summary.questions} interview questions, {preview.summary.terms}{" "}
            glossary terms.
          </p>
          {d.identical ? (
            <p className="notice" role="status">
              No changes: this file is identical to the published one.
            </p>
          ) : (
            <div className="diff">
              <List title="New pages" items={d.addedPages.map(p)} />
              <List title="Coming soon → published" items={d.nowPublished.map(p)} />
              <List title="Published → coming soon" items={d.nowComingSoon.map(p)} tone="warn" />
              <List title="Removed pages" items={d.removedPages.map(p)} tone="warn" />
              <List
                title="Address changes (old links redirect)"
                items={d.renamedSlugs.map((r) => `${r.key}: ${r.from} → ${r.to}`)}
              />
              <List
                title="Edited pages"
                items={d.changedPages.map((c) => {
                  const bits = [
                    c.changedSections.length && `${c.changedSections.length} section(s) edited`,
                    c.addedSections.length && `${c.addedSections.length} section(s) added`,
                    c.removedSections.length && `${c.removedSections.length} section(s) removed`,
                    c.addedSteps.length && `${c.addedSteps.length} lab step(s) added`,
                    c.removedSteps.length && `${c.removedSteps.length} lab step(s) removed`,
                    c.addedCards && `${c.addedCards} question(s) added`,
                    c.removedCards && `${c.removedCards} question(s) removed`,
                  ].filter(Boolean);
                  return `${c.title} (${c.key}): ${bits.join(", ")}`;
                })}
              />
              <List
                title="Removed items learners may have progress on"
                items={d.removedKeys.map((k) => `${k.kind} ${k.pageKey}/${k.key}`)}
                tone="warn"
              />
              <List title="Import warnings" items={d.warnings} tone="warn" />
            </div>
          )}
        </section>
      )}

      {preview && d && !d.identical && (
        <section className="panel" aria-labelledby="publish-h">
          <h2 id="publish-h">3. Publish</h2>
          {status.publishing ? (
            <p style={{ margin: 0 }}>
              Commits to <code>{status.publishing.repo}</code> on{" "}
              <code>{status.publishing.branch}</code>. The site rebuilds and deploys in a few
              minutes.
            </p>
          ) : (
            <p className="notice" style={{ margin: 0 }}>
              Publishing to GitHub isn&apos;t set up on this server. Pressing Publish shows the
              steps to publish from a computer instead.
            </p>
          )}
          {d.removedKeys.length > 0 && (
            <label className="ack">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I
              understand {d.removedKeys.length} item(s) learners may have progress on will no longer
              be shown. Their progress is kept.
            </label>
          )}
          <label className="admin-form" style={{ gridTemplateColumns: "1fr" }}>
            Commit message (optional)
            <input
              className="field"
              value={message}
              maxLength={200}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Content: add Chapter 30"
            />
          </label>
          {done ? (
            <p className="notice" role="status">
              Published. <a href={done.commitUrl}>See the commit on GitHub</a>.
            </p>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={busy || (d.removedKeys.length > 0 && !ack)}
              onClick={async () => {
                const r = await post({
                  action: "publish",
                  course,
                  markdown: file!.text,
                  hash: preview.hash,
                  acknowledgeRemovals: ack,
                  message: message || undefined,
                });
                if (r?.ok) setDone(r);
              }}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
