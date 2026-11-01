import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "@/components/search-view";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <main id="main" className="wrap panel-wrap">
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Search</h1>
      <Suspense fallback={<p className="muted">Loading search…</p>}>
        <SearchView />
      </Suspense>
    </main>
  );
}
