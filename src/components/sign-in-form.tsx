"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ next, google }: { next: string; google: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  if (state === "sent")
    return (
      <div className="card" role="status" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Check your email</h2>
        <p style={{ margin: "8px 0 0" }}>
          We sent a sign-in link to <strong>{email}</strong>. It works once and expires in 10
          minutes.
        </p>
        <button type="button" className="link-btn" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
      <form
        style={{ display: "grid", gap: 10 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setState("sending");
          const res = await authClient.signIn.magicLink({
            email,
            callbackURL: next,
            errorCallbackURL: `/sign-in?error=link&next=${encodeURIComponent(next)}`,
          });
          if (res.error) {
            setState("error");
            setMessage(
              res.error.status === 429
                ? "Too many sign-in links requested. Try again in an hour."
                : (res.error.message ?? "We couldn't send the link. Try again."),
            );
          } else setState("sent");
        }}
      >
        <label htmlFor="email">
          <strong>Email address</strong>
        </label>
        <input
          id="email"
          className="field"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn primary" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
        {state === "error" && (
          <p role="alert" style={{ color: "var(--decide)", margin: 0 }}>
            {message}
          </p>
        )}
      </form>
      {google && (
        <>
          <p className="muted small" style={{ textAlign: "center", margin: 0 }}>
            or
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}
          >
            Continue with Google
          </button>
        </>
      )}
    </div>
  );
}
