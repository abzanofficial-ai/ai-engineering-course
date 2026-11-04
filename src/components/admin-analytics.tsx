"use client";

// The platform owner's analytics screen (ADR-0032): counts only, never lists of learners.
import { useCallback, useEffect, useState } from "react";

interface Data {
  tenants: { id: string; name: string }[];
  tenantId: string;
  courses: string[];
  course: string;
  days: number;
  totals: { visits: number; signups: number; activeLearners: number; learnerPlaces: number };
  bySource: { source: string; medium: string; visits: number; signups: number }[];
  weekly: { week: string; activeLearners: number }[];
  chapters: { key: string; label: string; title: string; started: number; finished: number }[];
  checkpoints: { part: number; attempted: number; passed: number }[];
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
const fmt = (n: number) => n.toLocaleString("en-GB");
const weekLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function AdminAnalytics() {
  const [data, setData] = useState<Data | null>(null);
  const [query, setQuery] = useState<{ tenant?: string; course?: string; days: string }>({
    days: "30",
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams(
      Object.entries(query).filter((e): e is [string, string] => Boolean(e[1])),
    );
    const res = await fetch(`/api/admin/analytics?${q}`);
    const body = await res.json();
    if (res.ok) {
      setData(body);
      setError(null);
    } else setError(body.error ?? "Couldn't load.");
  }, [query]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p className="muted">Loading…</p>;
  const t = data.totals;
  const maxWeek = Math.max(1, ...data.weekly.map((w) => w.activeLearners));

  return (
    <div className="admin-grid">
      <div className="admin-bar">
        <label>
          Tenant{" "}
          <select
            className="field"
            value={data.tenantId}
            onChange={(e) => setQuery({ ...query, tenant: e.target.value })}
          >
            {data.tenants.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Course{" "}
          <select
            className="field"
            value={data.course}
            onChange={(e) => setQuery({ ...query, course: e.target.value })}
          >
            {data.courses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Period{" "}
          <select
            className="field"
            value={String(data.days)}
            onChange={(e) => setQuery({ ...query, days: e.target.value })}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
      </div>

      <section aria-labelledby="funnel-h" className="panel">
        <h2 id="funnel-h">Last {data.days} days</h2>
        <dl className="stat-tiles">
          <div>
            <dt>Visits</dt>
            <dd>{fmt(t.visits)}</dd>
          </div>
          <div>
            <dt>New learners</dt>
            <dd>{fmt(t.signups)}</dd>
            <dd className="stat-note">{pct(t.signups, t.visits)} of visits</dd>
          </div>
          <div>
            <dt>Active learners</dt>
            <dd>{fmt(t.activeLearners)}</dd>
          </div>
          <div>
            <dt>Paid or centre places</dt>
            <dd>{fmt(t.learnerPlaces)}</dd>
            <dd className="stat-note">{pct(t.learnerPlaces, t.signups)} of new learners</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="sources-h" className="panel">
        <h2 id="sources-h">Where they came from</h2>
        {data.bySource.length === 0 ? (
          <p className="muted">No visits in this period yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">Medium</th>
                  <th scope="col" className="num">
                    Visits
                  </th>
                  <th scope="col" className="num">
                    New learners
                  </th>
                  <th scope="col" className="num">
                    Conversion
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.bySource.map((s) => (
                  <tr key={`${s.source}/${s.medium}`}>
                    <th scope="row">{s.source}</th>
                    <td>{s.medium || "—"}</td>
                    <td className="num">{fmt(s.visits)}</td>
                    <td className="num">{fmt(s.signups)}</td>
                    <td className="num">{pct(s.signups, s.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="weekly-h" className="panel">
        <h2 id="weekly-h">Active learners each week</h2>
        {data.weekly.length === 0 ? (
          <p className="muted">No learning activity in this period yet.</p>
        ) : (
          <table className="bar-table">
            <thead>
              <tr>
                <th scope="col">Week starting</th>
                <th scope="col">Active learners</th>
              </tr>
            </thead>
            <tbody>
              {data.weekly.map((w) => (
                <tr key={w.week}>
                  <th scope="row">{weekLabel(w.week)}</th>
                  <td>
                    <span className="hbar">
                      <span
                        className="hbar-fill"
                        style={{ width: `${(w.activeLearners / maxWeek) * 100}%` }}
                      />
                    </span>
                    <span className="hbar-value">{fmt(w.activeLearners)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="chapters-h" className="panel">
        <h2 id="chapters-h">Chapters: started and finished</h2>
        <p className="muted small">
          All time. Finished means every Learn section read. A big drop between neighbouring
          chapters shows where learners stop.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Chapter</th>
                <th scope="col" className="num">
                  Started
                </th>
                <th scope="col" className="num">
                  Finished
                </th>
                <th scope="col" className="num">
                  Finish rate
                </th>
              </tr>
            </thead>
            <tbody>
              {data.chapters.map((c) => (
                <tr key={c.key}>
                  <th scope="row">{c.label ? `${c.label}: ${c.title}` : c.title}</th>
                  <td className="num">{fmt(c.started)}</td>
                  <td className="num">{fmt(c.finished)}</td>
                  <td className="num">{pct(c.finished, c.started)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="checkpoints-h" className="panel">
        <h2 id="checkpoints-h">Part checkpoints</h2>
        {data.checkpoints.length === 0 ? (
          <p className="muted">No checkpoint attempts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Part</th>
                <th scope="col" className="num">
                  Learners who tried
                </th>
                <th scope="col" className="num">
                  Passed
                </th>
                <th scope="col" className="num">
                  Pass rate
                </th>
              </tr>
            </thead>
            <tbody>
              {data.checkpoints.map((c) => (
                <tr key={c.part}>
                  <th scope="row">Part {c.part}</th>
                  <td className="num">{fmt(c.attempted)}</td>
                  <td className="num">{fmt(c.passed)}</td>
                  <td className="num">{pct(c.passed, c.attempted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
