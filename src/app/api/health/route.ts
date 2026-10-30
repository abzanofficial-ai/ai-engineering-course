import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";

/** GET /api/health — for uptime checks (ADR-0013). */
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
