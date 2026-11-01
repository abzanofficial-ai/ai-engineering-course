// Server-side authorisation helpers. Personal data is only ever read or written with the
// userId returned here — never with an id from the request (architecture §8, A01).
import { getAuth } from "./auth-config";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  platformRole: "platform_owner" | null;
}

export async function getUser(headers: Headers): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  const u = session.user as typeof session.user & { platformRole?: string | null };
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    platformRole: u.platformRole === "platform_owner" ? "platform_owner" : null,
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** State-changing requests must come from our own origin with a JSON body (CSRF defence). */
export function requireSameOriginJson(req: Request): void {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "Cross-origin request refused.");
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json"))
    throw new HttpError(415, "Send JSON.");
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError)
    return Response.json({ error: err.message }, { status: err.status });
  if (err && typeof err === "object" && "issues" in err)
    return Response.json({ error: "Invalid request." }, { status: 400 });
  console.error(err);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
