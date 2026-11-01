"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { clearLearnerStorage } from "./learner/provider";

async function call(method: string, body: unknown) {
  const res = await fetch("/api/me", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: json.error };
}

export function AccountForms({ name, email }: { name: string; email: string }) {
  const [displayName, setDisplayName] = useState(name);
  const [nameMsg, setNameMsg] = useState("");
  const [confirm, setConfirm] = useState("");
  const [delMsg, setDelMsg] = useState("");

  return (
    <>
      <section className="card" aria-labelledby="profile-h" style={{ display: "grid", gap: 10 }}>
        <h2 id="profile-h" style={{ margin: 0, fontSize: "1.2rem" }}>
          Profile
        </h2>
        <p className="muted small" style={{ margin: 0 }}>
          Signed in as {email}.
        </p>
        <form
          style={{ display: "grid", gap: 10 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await call("PATCH", { name: displayName });
            setNameMsg(r.ok ? "Saved." : (r.error ?? "Couldn't save. Try again."));
          }}
        >
          <label htmlFor="name">
            <strong>Name on your certificates</strong>
          </label>
          <input
            id="name"
            className="field"
            value={displayName}
            maxLength={80}
            required
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button type="submit" className="btn" style={{ justifySelf: "start" }}>
            Save name
          </button>
          <p role="status" className="small" style={{ margin: 0 }}>
            {nameMsg}
          </p>
        </form>
      </section>

      <section className="card" aria-labelledby="data-h" style={{ display: "grid", gap: 10 }}>
        <h2 id="data-h" style={{ margin: 0, fontSize: "1.2rem" }}>
          Your data
        </h2>
        <p className="small" style={{ margin: 0 }}>
          Download everything we hold about you: profile, progress, answers, XP and activity, as a
          JSON file.
        </p>
        <a className="btn" href="/api/me/export" style={{ justifySelf: "start" }}>
          Download my data
        </a>
      </section>

      <section className="card" aria-labelledby="out-h" style={{ display: "grid", gap: 10 }}>
        <h2 id="out-h" style={{ margin: 0, fontSize: "1.2rem" }}>
          Sign out
        </h2>
        <button
          type="button"
          className="btn"
          style={{ justifySelf: "start" }}
          onClick={async () => {
            await authClient.signOut();
            clearLearnerStorage();
            // A full reload clears the in-memory learner state and outbox for this tab.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/home";
          }}
        >
          Sign out on this device
        </button>
      </section>

      <section className="card" aria-labelledby="del-h" style={{ display: "grid", gap: 10 }}>
        <h2 id="del-h" style={{ margin: 0, fontSize: "1.2rem" }}>
          Delete my account
        </h2>
        <p className="small" style={{ margin: 0 }}>
          This permanently deletes your account, progress, answers, XP and certificates. It
          can&apos;t be undone. Backups age out within 7 days.
        </p>
        <form
          style={{ display: "grid", gap: 10 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await call("DELETE", { confirmEmail: confirm });
            // Full reload: nothing of the deleted account may remain in memory.
            if (r.ok) {
              clearLearnerStorage();
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/home?deleted=1";
            } else setDelMsg(r.error ?? "Couldn't delete. Try again.");
          }}
        >
          <label htmlFor="confirm-email">Type your email address to confirm</label>
          <input
            id="confirm-email"
            className="field"
            type="email"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="submit"
            className="btn danger"
            style={{ justifySelf: "start" }}
            disabled={confirm.trim().toLowerCase() !== email.toLowerCase()}
          >
            Delete my account
          </button>
          <p role="alert" className="small" style={{ margin: 0 }}>
            {delMsg}
          </p>
        </form>
      </section>
    </>
  );
}
