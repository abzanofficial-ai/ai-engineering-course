"use client";

// Full-text search over the whole course (ADR-0008). Pagefind loads only the index chunks a
// query needs, so searching costs no server work.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Hit {
  url: string;
  excerpt: string;
  title: string;
  page: string;
}
interface Pagefind {
  search: (q: string) => Promise<{
    results: {
      data: () => Promise<{ url: string; excerpt: string; meta: Record<string, string> }>;
    }[];
  }>;
}

let loading: Promise<Pagefind> | null = null;
function loadPagefind(): Promise<Pagefind> {
  const url = "/pagefind/pagefind.js";
  loading ??= import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ url
  ) as Promise<Pagefind>;
  return loading;
}

export function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const id = ++latest.current;
    const t = setTimeout(async () => {
      if (!q) {
        setHits(null);
        return;
      }
      try {
        const pf = await loadPagefind();
        const res = await pf.search(q);
        const data = await Promise.all(res.results.slice(0, 20).map((r) => r.data()));
        if (id !== latest.current) return; // a newer query is in flight
        setHits(
          data.map((d) => ({
            url: d.url,
            excerpt: d.excerpt,
            title: d.meta.title ?? "",
            page: d.meta.page ?? "",
          })),
        );
        setError(false);
        router.replace(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
      } catch {
        setError(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, router]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form role="search" onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 8 }}>
        <label htmlFor="q">
          <strong>Search the whole course</strong>
        </label>
        <input
          id="q"
          className="field"
          type="search"
          autoComplete="off"
          autoFocus
          placeholder="e.g. idempotency key, prompt injection, chunk size"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <p className="muted small" role="status" aria-live="polite" style={{ margin: 0 }}>
        {error
          ? "Search isn't available right now. Check your connection and try again."
          : hits === null
            ? "Searches every chapter, lab step, drill and question."
            : `${hits.length === 20 ? "20+" : hits.length} result${hits.length === 1 ? "" : "s"}`}
      </p>
      {hits && hits.length > 0 && (
        <ol className="results">
          {hits.map((h) => (
            <li key={h.url}>
              <Link href={h.url} className="result">
                <span className="result-page">{h.page}</span>
                <span className="result-title">{h.title}</span>
                {/* Pagefind excerpts are escaped text with <mark> around matches. */}
                <span className="result-excerpt" dangerouslySetInnerHTML={{ __html: h.excerpt }} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
