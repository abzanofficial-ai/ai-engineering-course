"use client";

// Source tracking without cookies or device storage (ADR-0032). The source of this visit is kept
// in memory only, so it lasts while the visitor moves around the site and is gone when they
// close the tab. Visitors are counted once per page load; a new learner's source travels to
// the server on the sign-in link and is recorded once, then removed from the address bar.
import { useEffect } from "react";
import { DIRECT, sourceFrom, UTM_KEYS, type Source } from "@/lib/attribution";
import { useLearner } from "./learner/provider";

let current: Source | null = null;
let counted = false;
let attributed = false;

/** The source of this visit, for the sign-in link (null until the page has loaded). */
export function currentSource(): Source | null {
  return current;
}

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => null);

export function Attribution() {
  const { status } = useLearner();

  useEffect(() => {
    current ??= sourceFrom(
      new URLSearchParams(window.location.search),
      document.referrer,
      window.location.host,
    );
    if (status === "anon" && !counted) {
      counted = true;
      void post("/api/visit", current);
    }
    if (status === "ready" && !attributed) {
      attributed = true;
      const params = new URLSearchParams(window.location.search);
      if (!params.has("utm_source")) return;
      if (current.source !== DIRECT.source) void post("/api/me/attribution", current);
      for (const k of UTM_KEYS) params.delete(k);
      const q = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`,
      );
    }
  }, [status]);

  return null;
}
