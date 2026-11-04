// Feature flags (ADR-0031): the owner switches launch mode from the admin API, and the access
// check, the request gate (proxy) and the plans page follow it.
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import * as accessPage from "@/app/access/route";
import * as flagsApi from "@/app/api/admin/flags/route";
import { proxy } from "@/proxy";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { flagsFor, listFlags, setFlag } from "@/server/repo/flags";
import { DEFAULT_TENANT_ID } from "@/server/repo/tenant";
import { BASE, req, signIn } from "./auth-helpers";
import { COURSE, makeUser } from "./helpers";

const PAID = `/learn/${COURSE}/21-tool-calling-and-function-calling`;

const setLaunch = (cookie: string, enabled: boolean | null, key = "launch_open_access") =>
  flagsApi.POST(
    req("/api/admin/flags", cookie, {
      method: "POST",
      json: { tenantId: DEFAULT_TENANT_ID, key, enabled },
    }),
  );

const gate = (cookie: string) => proxy(new NextRequest(`${BASE}${PAID}`, { headers: { cookie } }));

describe("feature flags", () => {
  it("defaults come from the tenant config until an override is stored", async () => {
    expect((await flagsFor(DEFAULT_TENANT_ID)).launch_open_access).toBe(true);
    const [row] = await listFlags(DEFAULT_TENANT_ID);
    expect(row).toMatchObject({
      key: "launch_open_access",
      enabled: true,
      defaultValue: true,
      overridden: false,
    });
  });

  it("the owner turns launch mode off: access, the proxy and the API all follow; reset restores it", async () => {
    const owner = await signIn("owner@example.test");
    const learner = await signIn("flag-learner@example.test");

    // Launch mode on: paid pages pass the gate without an access pass.
    expect((await gate(learner)).headers.get("location")).toBeNull();
    const open = await accessPage.GET(req(`/access?next=${encodeURIComponent(PAID)}`, learner));
    expect(open.headers.get("location")).toBe(`${BASE}${PAID}`);

    const off = await setLaunch(owner, false);
    expect(off.status).toBe(200);
    const body = await off.json();
    expect(body.flags[0]).toMatchObject({
      enabled: false,
      overridden: true,
      updatedByEmail: "owner@example.test",
    });

    // Launch mode off: the gate asks for a pass, and /access sends the learner to the plans.
    expect(new URL((await gate(learner)).headers.get("location")!).pathname).toBe("/access");
    const closed = await accessPage.GET(req(`/access?next=${encodeURIComponent(PAID)}`, learner));
    expect(closed.headers.get("location")).toContain("/plans?next=");

    // Reset: the default (on) applies again and the override row is gone.
    const reset = await (await setLaunch(owner, null)).json();
    expect(reset.flags[0]).toMatchObject({ enabled: true, overridden: false });
    expect((await gate(learner)).headers.get("location")).toBeNull();
  });

  it("refuses unknown flags and unknown tenants", async () => {
    const owner = await signIn("owner@example.test");
    expect((await setLaunch(owner, true, "not_a_flag")).status).toBe(400);
    expect((await setLaunch(owner, true, "constructor")).status).toBe(400);
    const badTenant = await flagsApi.POST(
      req("/api/admin/flags", owner, {
        method: "POST",
        json: { tenantId: "tnt_nope", key: "launch_open_access", enabled: false },
      }),
    );
    expect(badTenant.status).toBe(400);
    expect((await flagsApi.GET(req("/api/admin/flags?tenant=tnt_nope", owner))).status).toBe(400);
  });

  it("an override survives the person who set it being deleted", async () => {
    const id = await makeUser("flag-setter");
    await setFlag(DEFAULT_TENANT_ID, "launch_open_access", false, id);
    expect((await flagsFor(DEFAULT_TENANT_ID)).launch_open_access).toBe(false);
    await db().delete(user).where(eq(user.id, id));
    const [row] = await listFlags(DEFAULT_TENANT_ID);
    expect(row).toMatchObject({ enabled: false, overridden: true, updatedByEmail: null });
  });
});
