import { eq } from "drizzle-orm";
import { z } from "zod";
import { deleteUser } from "@/server/account";
import { db } from "@/server/db/client";
import { user as userTable } from "@/server/db/schema";
import { log } from "@/server/log";
import { errorResponse, HttpError, requireSameOriginJson, requireUser } from "@/server/session";

const profileSchema = z.object({ name: z.string().trim().min(1).max(80) });
const deleteSchema = z.object({ confirmEmail: z.string() });

/** PATCH /api/me — update the name shown on certificates. */
export async function PATCH(req: Request) {
  try {
    requireSameOriginJson(req);
    const user = await requireUser(req);
    const { name } = profileSchema.parse(await req.json());
    await db().update(userTable).set({ name }).where(eq(userTable.id, user.id));
    return Response.json({ ok: true, name });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/me — delete the account and all learning data. The learner types their email to confirm. */
export async function DELETE(req: Request) {
  try {
    requireSameOriginJson(req);
    const user = await requireUser(req);
    const { confirmEmail } = deleteSchema.parse(await req.json());
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase())
      throw new HttpError(400, "That email doesn't match your account.");
    await deleteUser(db(), user.id);
    log.info("account.deleted");
    const res = Response.json({ ok: true });
    for (const name of ["better-auth.session_token", "__Secure-better-auth.session_token"])
      res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
