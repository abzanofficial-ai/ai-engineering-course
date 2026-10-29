"use client";

import { useEffect, useState } from "react";

export interface TocItem {
  key: string;
  title: string;
}

/** "On this page" list with the current section highlighted (aria-current). */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.key))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  return (
    <ol className="space-y-1 text-sm">
      {items.map((i) => (
        <li key={i.key}>
          <a
            href={`#${i.key}`}
            aria-current={active === i.key ? "location" : undefined}
            className={`block rounded px-2 py-1.5 no-underline ${active === i.key ? "bg-surface font-bold text-text" : "text-muted hover:text-text"}`}
          >
            {i.title}
          </a>
        </li>
      ))}
    </ol>
  );
}
