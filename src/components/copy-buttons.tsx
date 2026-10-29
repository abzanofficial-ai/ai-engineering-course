"use client";

import { useEffect } from "react";

/** Text to copy from a code block: for shell blocks with `$ ` prompts, only the commands. */
export function copyTextFor(code: string, mode: string | undefined): string {
  if (mode !== "shell") return code.replace(/\n$/, "");
  return code
    .split("\n")
    .filter((l) => l.startsWith("$ "))
    .map((l) => l.slice(2))
    .join("\n");
}

/** One delegated listener handles every copy button on the page (code blocks and prompts). */
export function CopyButtons() {
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button[data-copy], button[data-copy-text]",
      );
      if (!button) return;
      let text = button.dataset.copyText;
      if (text === undefined) {
        const figure = button.closest<HTMLElement>("figure.code");
        text = copyTextFor(
          figure?.querySelector("pre")?.textContent ?? "",
          figure?.dataset.copyMode,
        );
      }
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
      } catch {
        button.textContent = "Copy failed";
      }
      const live = document.getElementById("copy-status");
      if (live) live.textContent = button.textContent ?? "";
      window.setTimeout(() => (button.textContent = original), 2000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return <p id="copy-status" role="status" aria-live="polite" className="sr-only" />;
}
