"use client";

// Redeem a training centre's join code (ADR-0030).
import Link from "next/link";
import { useState } from "react";

export function JoinForm({ course }: { course: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orgName: string; endsAt: string; already: boolean } | null>(
    null,
  );

  if (done)
    return (
      <div className="chapter-done" role="status">
        <h2 style={{ margin: 0 }}>{done.already ? "You're already in" : "You're in"}</h2>
        <p>
          Your place from {done.orgName} gives you the full course until{" "}
          {new Date(done.endsAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
        <Link className="btn primary" href={`/learn/${course}`}>
          Start learning
        </Link>
      </div>
    );

  return (
    <form
      className="join-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/me/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "Something went wrong. Try again.");
          setDone(body);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="join-code">
        <strong>Join code</strong>
      </label>
      <input
        id="join-code"
        className="field join-code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="ABCD-EFGH-JKMN"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-describedby={error ? "join-error" : undefined}
      />
      {error && (
        <p id="join-error" className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn primary" disabled={busy || !code.trim()}>
        Join the course
      </button>
    </form>
  );
}
