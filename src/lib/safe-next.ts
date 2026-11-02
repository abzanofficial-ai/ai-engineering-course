// Where to send someone after sign-in or an access check (no open redirect). The value is
// resolved the way a browser would resolve it, so tricks like "/\evil.example" or "/\t/evil"
// (which browsers treat as "//evil…") are caught by comparing origins, not by string prefixes.
const BASE = "https://same-site.invalid";

export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
