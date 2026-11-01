"use client";

// Definitions for the chapter's own terms where they are first used in the text. The importer
// marks them as <button class="term-ref" data-term>; this listens for hover, tap and keyboard.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TermDef {
  id: string;
  term: string;
  slug: string;
  html: string;
}

interface Open {
  def: TermDef;
  button: HTMLElement;
  pinned: boolean; // opened by click/keyboard: stays until dismissed
  top: number;
  left: number;
}

const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export function TermPopover({ course, terms }: { course: string; terms: TermDef[] }) {
  const [open, setOpen] = useState<Open | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const byId = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);

  const place = useCallback((button: HTMLElement, def: TermDef, pinned: boolean): Open => {
    const r = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 32);
    const left = Math.max(
      16,
      Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - width - 16),
    );
    return { def, button, pinned, top: r.bottom + window.scrollY + 8, left };
  }, []);

  const openRef = useRef<Open | null>(null);
  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    open.button.setAttribute("aria-expanded", "true");
    return () => open.button.setAttribute("aria-expanded", "false");
  }, [open]);

  const close = useCallback((returnFocus: boolean) => {
    const o = openRef.current;
    setOpen(null);
    if (o && returnFocus) o.button.focus();
  }, []);

  useEffect(() => {
    const target = (e: Event) =>
      (e.target as Element | null)?.closest?.<HTMLElement>("button.term-ref");
    const onClick = (e: MouseEvent) => {
      const b = target(e);
      if (!b) {
        if (!box.current?.contains(e.target as Node)) close(false);
        return;
      }
      const def = byId.get(b.dataset.term ?? "");
      if (!def) return;
      e.preventDefault();
      setOpen(place(b, def, true));
      requestAnimationFrame(() => box.current?.focus());
    };
    const onOver = (e: MouseEvent) => {
      const b = target(e);
      if (!b || !finePointer()) return;
      const def = byId.get(b.dataset.term ?? "");
      if (!def) return;
      clearTimeout(closeTimer.current);
      setOpen((o) => (o?.pinned ? o : place(b, def, false)));
    };
    const onOut = (e: MouseEvent) => {
      if (!target(e)) return;
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(
        () => setOpen((o) => (o && !o.pinned && !box.current?.matches(":hover") ? null : o)),
        250,
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("keydown", onKey);
    // Every marked term opens a definition; say so to assistive tech.
    for (const b of document.querySelectorAll<HTMLElement>("button.term-ref")) {
      b.setAttribute("aria-haspopup", "dialog");
      b.setAttribute("aria-expanded", "false");
    }
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("keydown", onKey);
      clearTimeout(closeTimer.current);
    };
  }, [place, close, byId]);

  if (!open) return null;
  return (
    <div
      ref={box}
      className="term-pop"
      role="dialog"
      aria-label={`Definition: ${open.def.term}`}
      tabIndex={-1}
      style={{ top: open.top, left: open.left }}
      onMouseLeave={() => {
        if (!open.pinned) setOpen(null);
      }}
    >
      <strong className="term-pop-term">{open.def.term}</strong>
      <p dangerouslySetInnerHTML={{ __html: open.def.html }} />
      <div className="term-pop-actions">
        <Link href={`/learn/${course}/glossary#${open.def.slug}`}>
          All definitions in the glossary
        </Link>
        <button type="button" className="btn small" onClick={() => close(true)}>
          Close
        </button>
      </div>
    </div>
  );
}
