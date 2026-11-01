// A short-lived signed pass that lets the proxy serve paid static pages without a database
// call (ADR-0030). It is bound to the session cookie, so it cannot be moved to another session.
// Web Crypto, so it runs wherever the proxy runs.
export const PASS_COOKIE = "hb_pass";
export const PASS_SECONDS = 15 * 60;

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

async function sessionTag(session: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(session)))).slice(
    0,
    22,
  );
}

export interface PassClaims {
  /** Courses the learner may read in full. */
  courses: string[];
  /** Unix seconds. */
  exp: number;
}

export async function signPass(
  secret: string,
  session: string,
  courses: string[],
  now = Date.now(),
) {
  const body = b64url(
    enc.encode(
      JSON.stringify({
        s: await sessionTag(session),
        c: courses,
        exp: Math.floor(now / 1000) + PASS_SECONDS,
      }),
    ),
  );
  return `${body}.${await hmac(secret, body)}`;
}

/** The pass's courses, or null if it is forged, expired or from another session. */
export async function verifyPass(
  secret: string,
  session: string,
  pass: string | undefined,
  now = Date.now(),
): Promise<PassClaims | null> {
  if (!pass) return null;
  const [body, sig] = pass.split(".");
  if (!body || !sig || (await hmac(secret, body)) !== sig) return null;
  try {
    const json = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))) as {
      s: string;
      c: string[];
      exp: number;
    };
    if (json.s !== (await sessionTag(session)) || json.exp * 1000 <= now) return null;
    return { courses: json.c, exp: json.exp };
  } catch {
    return null;
  }
}
