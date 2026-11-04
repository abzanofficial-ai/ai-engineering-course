// Where visitors and new learners come from (ADR-0032), without cookies or device storage:
// UTM parameters on the link, or else the referring site. Values are normalised so that
// "LinkedIn", "linkedin" and "lnkd.in" count as one source.
import { z } from "zod";

export interface Source {
  source: string;
  medium: string;
  campaign: string;
}

export const DIRECT: Source = { source: "direct", medium: "", campaign: "" };
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

const token = z
  .string()
  .max(40)
  .regex(/^[a-z0-9._-]*$/);
export const sourceSchema = z.object({
  source: token.min(1),
  medium: token,
  campaign: token,
});

/** Lower-case, keep letters, digits, dot, dash and underscore; spaces become dashes. */
export function clean(v: string | null | undefined): string {
  return (v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

const HOST_ALIASES: Record<string, string> = {
  "lnkd.in": "linkedin.com",
  "t.co": "x.com",
  "twitter.com": "x.com",
  "l.facebook.com": "facebook.com",
  "lm.facebook.com": "facebook.com",
  "l.instagram.com": "instagram.com",
  "youtu.be": "youtube.com",
  "out.reddit.com": "reddit.com",
  "old.reddit.com": "reddit.com",
  "news.ycombinator.com": "hackernews",
};
const SEARCH = /^(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex)\./;

/** A referring page's host, as a source; null for our own site or an unreadable referrer. */
export function referrerSource(
  referrer: string | null | undefined,
  ownHost: string,
): Source | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).host.toLowerCase();
  } catch {
    return null;
  }
  if (!host || host === ownHost.toLowerCase()) return null;
  host = host.replace(/^(www|m|mobile)\./, "");
  host = HOST_ALIASES[host] ?? host;
  const search = host.match(SEARCH);
  if (search) return { source: search[1]!, medium: "organic", campaign: "" };
  return { source: clean(host), medium: "referral", campaign: "" };
}

/** The source of this visit: UTM parameters first, then the referring site, else direct. */
export function sourceFrom(
  search: URLSearchParams,
  referrer: string | null | undefined,
  ownHost: string,
): Source {
  const utm = clean(search.get("utm_source"));
  if (utm)
    return {
      source: utm,
      medium: clean(search.get("utm_medium")),
      campaign: clean(search.get("utm_campaign")),
    };
  return referrerSource(referrer, ownHost) ?? DIRECT;
}

/** Adds the source to an internal path as UTM parameters (nothing for direct visits). */
export function withSource(path: string, s: Source | null): string {
  if (!s || s.source === DIRECT.source) return path;
  const url = new URL(path, "https://x.invalid");
  url.searchParams.set("utm_source", s.source);
  if (s.medium) url.searchParams.set("utm_medium", s.medium);
  if (s.campaign) url.searchParams.set("utm_campaign", s.campaign);
  return `${url.pathname}${url.search}${url.hash}`;
}
