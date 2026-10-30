"use client";

// The platform owner's commercial screen (ADR-0030).
import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/plans";

interface Overview {
  tenants: { id: string; slug: string; name: string; status: string }[];
  tenantId: string;
  month: string;
  courses: string[];
  defaults: {
    seatPack: { accessMonths: number };
    centreLicence: { basePence: number; includedLearners: number; extraLearnerPence: number };
  };
  packs: {
    id: string;
    course: string;
    orgName: string;
    seats: number;
    used: number;
    accessMonths: number;
    codeHint: string;
    redeemBy: string | null;
    revokedAt: string | null;
  }[];
  grants: {
    id: string;
    email: string;
    course: string;
    source: string;
    orgName: string | null;
    endsAt: string | null;
    active: boolean;
  }[];
  usage: {
    activeLearners: number;
    licence: {
      basePence: number;
      includedLearners: number;
      extraLearnerPence: number;
      status: string;
    } | null;
    invoice: { base: number; extra: number; extraPence: number; total: number } | null;
  };
}

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export function AdminCommerce() {
  const [data, setData] = useState<Overview | null>(null);
  const [tenant, setTenant] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [newCode, setNewCode] = useState<{ code: string; org: string } | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ month, ...(tenant ? { tenant } : {}) });
    const res = await fetch(`/api/admin/commerce?${q}`);
    const body = await res.json();
    if (res.ok) setData(body);
    else setMessage({ kind: "error", text: body.error ?? "Couldn't load." });
  }, [tenant, month]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  async function act(payload: Record<string, unknown>, ok: string) {
    setMessage(null);
    const res = await fetch("/api/admin/commerce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ kind: "error", text: body.error ?? "That didn't work." });
      return null;
    }
    setMessage({ kind: "ok", text: ok });
    await load();
    return body;
  }

  if (!data) return <p className="muted">Loading…</p>;
  const lic = data.usage.licence ?? { ...data.defaults.centreLicence, status: "none" };
  const field = (form: HTMLFormElement, name: string) =>
    (form.elements.namedItem(name) as HTMLInputElement).value;
  const pence = (form: HTMLFormElement, name: string) =>
    Math.round(Number(field(form, name)) * 100);

  return (
    <div className="admin-grid">
      <div className="admin-bar">
        <label>
          Tenant{" "}
          <select
            className="field"
            value={data.tenantId}
            onChange={(e) => setTenant(e.target.value)}
          >
            {data.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Month{" "}
          <input
            className="field"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      {message && (
        <p
          className={message.kind === "ok" ? "notice" : "error"}
          role={message.kind === "ok" ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}

      <section className="panel" aria-labelledby="packs-h">
        <h2 id="packs-h">Seat packs</h2>
        {newCode && (
          <div className="code-reveal" role="status">
            <p>
              Join code for <strong>{newCode.org}</strong>. Copy it now: it is shown only once.
            </p>
            <output className="code-big" aria-label="Join code">
              {newCode.code}
            </output>
            <button
              type="button"
              className="btn small"
              onClick={() => navigator.clipboard?.writeText(newCode.code)}
            >
              Copy code
            </button>
          </div>
        )}
        <form
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const org = field(f, "orgName");
            const r = await act(
              {
                action: "create-pack",
                tenantId: data.tenantId,
                course: field(f, "course"),
                orgName: org,
                seats: Number(field(f, "seats")),
                accessMonths: Number(field(f, "accessMonths")),
                redeemBy: field(f, "redeemBy") || null,
              },
              "Seat pack created.",
            );
            if (r?.code) {
              setNewCode({ code: r.code, org });
              f.reset();
            }
          }}
        >
          <label>
            Centre name
            <input className="field" name="orgName" required minLength={2} maxLength={120} />
          </label>
          <label>
            Course
            <select className="field" name="course">
              {data.courses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Seats
            <input
              className="field"
              name="seats"
              type="number"
              min={1}
              max={10000}
              defaultValue={25}
              required
            />
          </label>
          <label>
            Months of access
            <input
              className="field"
              name="accessMonths"
              type="number"
              min={1}
              max={60}
              defaultValue={data.defaults.seatPack.accessMonths}
              required
            />
          </label>
          <label>
            Redeem by (optional)
            <input className="field" name="redeemBy" type="date" />
          </label>
          <button type="submit" className="btn primary">
            Create seat pack
          </button>
        </form>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Seat packs">
          <table>
            <thead>
              <tr>
                <th scope="col">Centre</th>
                <th scope="col">Used</th>
                <th scope="col">Code ends</th>
                <th scope="col">Access</th>
                <th scope="col">Redeem by</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.packs.length === 0 && (
                <tr>
                  <td colSpan={6}>No seat packs yet.</td>
                </tr>
              )}
              {data.packs.map((p) => (
                <tr key={p.id}>
                  <td>{p.orgName}</td>
                  <td>
                    {p.used} / {p.seats}
                  </td>
                  <td>…{p.codeHint}</td>
                  <td>{p.accessMonths} months</td>
                  <td>{day(p.redeemBy)}</td>
                  <td>
                    {p.revokedAt ? (
                      "Revoked"
                    ) : (
                      <span className="row-actions">
                        <button
                          type="button"
                          className="btn small"
                          onClick={async () => {
                            const r = await act(
                              { action: "regenerate-pack", packId: p.id },
                              "New code created.",
                            );
                            if (r?.code) setNewCode({ code: r.code, org: p.orgName });
                          }}
                        >
                          New code
                        </button>
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() =>
                            window.confirm(
                              `Stop new joins for ${p.orgName}? Learners who joined keep access.`,
                            ) && act({ action: "revoke-pack", packId: p.id }, "Seat pack revoked.")
                          }
                        >
                          Revoke
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="grants-h">
        <h2 id="grants-h">Access</h2>
        <form
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const r = await act(
              {
                action: "grant",
                tenantId: data.tenantId,
                course: field(f, "course"),
                email: field(f, "email"),
                endsAt: field(f, "endsAt") || null,
                note: field(f, "note") || null,
              },
              "Access granted.",
            );
            if (r) f.reset();
          }}
        >
          <label>
            Learner email
            <input className="field" name="email" type="email" required autoComplete="off" />
          </label>
          <label>
            Course
            <select className="field" name="course">
              {data.courses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Until (optional)
            <input className="field" name="endsAt" type="date" />
          </label>
          <label>
            Note (optional)
            <input className="field" name="note" maxLength={200} />
          </label>
          <button type="submit" className="btn primary">
            Grant access
          </button>
        </form>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Access">
          <table>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Through</th>
                <th scope="col">Until</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.grants.length === 0 && (
                <tr>
                  <td colSpan={5}>No access records yet.</td>
                </tr>
              )}
              {data.grants.map((g) => (
                <tr key={g.id}>
                  <td>{g.email}</td>
                  <td>
                    {g.source === "seat"
                      ? `Seat: ${g.orgName}`
                      : g.source === "direct"
                        ? "Purchase"
                        : "Admin grant"}
                  </td>
                  <td>{day(g.endsAt)}</td>
                  <td>{g.active ? "Active" : "Ended"}</td>
                  <td>
                    {g.active && (
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() =>
                          window.confirm(`Remove ${g.email}'s access?`) &&
                          act({ action: "revoke-grant", entitlementId: g.id }, "Access removed.")
                        }
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="licence-h">
        <h2 id="licence-h">Centre licence</h2>
        <p style={{ margin: 0 }}>
          {data.month}: <strong>{data.usage.activeLearners}</strong> active learner
          {data.usage.activeLearners === 1 ? "" : "s"}
          {data.usage.invoice &&
            ` · invoice ${money(data.usage.invoice.total)} (${money(data.usage.invoice.base)} base + ${data.usage.invoice.extra} × ${money(lic.extraLearnerPence)})`}
          {!data.usage.licence && " · no licence on this tenant"}
        </p>
        <form
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            await act(
              {
                action: "set-licence",
                tenantId: data.tenantId,
                basePence: pence(f, "base"),
                includedLearners: Number(field(f, "included")),
                extraLearnerPence: pence(f, "extra"),
                status: field(f, "status"),
                endsAt: field(f, "endsAt") || null,
              },
              "Licence saved.",
            );
          }}
        >
          <label>
            Monthly fee (£)
            <input
              className="field"
              name="base"
              type="number"
              min={0}
              step="0.01"
              defaultValue={lic.basePence / 100}
            />
          </label>
          <label>
            Included learners
            <input
              className="field"
              name="included"
              type="number"
              min={0}
              defaultValue={lic.includedLearners}
            />
          </label>
          <label>
            Per extra learner (£)
            <input
              className="field"
              name="extra"
              type="number"
              min={0}
              step="0.01"
              defaultValue={lic.extraLearnerPence / 100}
            />
          </label>
          <label>
            Status
            <select
              className="field"
              name="status"
              defaultValue={lic.status === "suspended" ? "suspended" : "active"}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <label>
            Ends (optional)
            <input className="field" name="endsAt" type="date" />
          </label>
          <button type="submit" className="btn primary">
            Save licence
          </button>
        </form>
      </section>
    </div>
  );
}
