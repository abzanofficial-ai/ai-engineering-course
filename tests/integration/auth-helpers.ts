import { getAuth } from "@/server/auth-config";
import { outbox } from "@/server/email";

export const BASE = "http://localhost:3000";

/** Signs in through the real magic-link flow and returns the session cookie header. */
export async function signIn(email: string): Promise<string> {
  outbox.length = 0;
  const res = await getAuth().handler(
    new Request(`${BASE}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email, callbackURL: "/" }),
    }),
  );
  if (!res.ok) throw new Error(`magic link request failed: ${res.status} ${await res.text()}`);
  const mail = outbox.find((m) => m.to === email);
  if (!mail) throw new Error("no magic link email captured");
  const link = mail.text.match(/https?:\/\/\S+/)![0];
  const verify = await getAuth().handler(new Request(link, { headers: { origin: BASE } }));
  const cookies = verify.headers.getSetCookie().map((c) => c.split(";")[0]!);
  const session = cookies.find((c) => c.includes("session_token"));
  if (!session) throw new Error(`no session cookie after verify (status ${verify.status})`);
  return session;
}

export function req(
  path: string,
  cookie: string | null,
  init: RequestInit & { json?: unknown } = {},
): Request {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  headers.set("origin", BASE);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  return new Request(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
}
