"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

// The <html data-theme> attribute (set before paint by THEME_SCRIPT) is the source of truth.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
function read(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
}

/** Cycles System → Light → Dark. The label states the current theme and the next action. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
  return (
    <button
      type="button"
      className="min-h-11 rounded-md border border-border px-3 text-sm text-text"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}`}
      onClick={() => apply(next)}
    >
      Theme: {LABEL[theme]}
    </button>
  );
}
