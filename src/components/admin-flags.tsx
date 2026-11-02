"use client";

// The platform owner's feature flags screen (ADR-0031).
import { useCallback, useEffect, useState } from "react";

interface FlagRow {
  key: string;
  label: string;
  description: string;
  warning: string | null;
  enabled: boolean;
  defaultValue: boolean;
  overridden: boolean;
  updatedAt: string | null;
  updatedByEmail: string | null;
}
interface Data {
  tenants: { id: string; name: string }[];
  tenantId: string;
  flags: FlagRow[];
}

const onOff = (v: boolean) => (v ? "On" : "Off");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function AdminFlags() {
  const [data, setData] = useState<Data | null>(null);
  const [tenant, setTenant] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/flags${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""}`,
    );
    const body = await res.json();
    if (res.ok) setData(body);
    else setMessage({ kind: "error", text: body.error ?? "Couldn't load." });
  }, [tenant]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  async function change(f: FlagRow, enabled: boolean | null) {
    const next = enabled ?? f.defaultValue;
    if (
      f.warning &&
      f.enabled &&
      !next &&
      !window.confirm(`${f.label}\n\n${f.warning}\n\nContinue?`)
    )
      return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/flags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: data!.tenantId, key: f.key, enabled }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "error", text: body.error ?? "That didn't work." });
      return;
    }
    setData({ ...data!, flags: body.flags });
    setMessage({
      kind: "ok",
      text:
        enabled === null
          ? `${f.label}: back to its default (${onOff(f.defaultValue).toLowerCase()}).`
          : `${f.label}: turned ${onOff(enabled).toLowerCase()}.`,
    });
  }

  if (!data) return <p className="muted">Loading…</p>;
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
      </div>

      {message && (
        <p
          className={message.kind === "ok" ? "notice" : "error"}
          role={message.kind === "ok" ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}

      {data.flags.map((f) => (
        <section key={f.key} className="panel flag-card" aria-labelledby={`flag-${f.key}`}>
          <div className="flag-head">
            <h2 id={`flag-${f.key}`}>{f.label}</h2>
            <span className={f.enabled ? "flag-state on" : "flag-state"}>{onOff(f.enabled)}</span>
          </div>
          <p>{f.description}</p>
          <p className="muted small">
            <code>{f.key}</code> · default {onOff(f.defaultValue).toLowerCase()}
            {f.overridden && f.updatedAt
              ? ` · changed ${when(f.updatedAt)}${f.updatedByEmail ? ` by ${f.updatedByEmail}` : ""}`
              : " · using the default"}
          </p>
          <div className="flag-actions">
            <button
              type="button"
              className={f.enabled ? "btn" : "btn primary"}
              disabled={busy}
              onClick={() => change(f, !f.enabled)}
            >
              {f.enabled ? "Turn off" : "Turn on"}
            </button>
            {f.overridden && (
              <button
                type="button"
                className="btn small"
                disabled={busy}
                onClick={() => change(f, null)}
              >
                Reset to default
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
