import { describe, expect, it } from "vitest";
import { PASS_SECONDS, signPass, verifyPass } from "./access-pass";

const SECRET = "test-secret-test-secret-test-secret";

describe("access pass", () => {
  it("round-trips for the same session until it expires", async () => {
    const now = Date.UTC(2026, 9, 30, 12);
    const pass = await signPass(SECRET, "session-a", ["ai-engineering-handbook"], now);
    expect(await verifyPass(SECRET, "session-a", pass, now + 1000)).toMatchObject({
      courses: ["ai-engineering-handbook"],
    });
    expect(await verifyPass(SECRET, "session-a", pass, now + PASS_SECONDS * 1000)).toBeNull();
  });

  it("is useless with another session, another secret or any change", async () => {
    const pass = await signPass(SECRET, "session-a", ["c"]);
    expect(await verifyPass(SECRET, "session-b", pass)).toBeNull();
    expect(await verifyPass("another-secret-another-secret-xx", "session-a", pass)).toBeNull();
    const [body, sig] = pass.split(".");
    const forged = btoa(JSON.stringify({ s: "x", c: ["c"], exp: 9e9 })).replace(/=+$/, "");
    expect(await verifyPass(SECRET, "session-a", `${forged}.${sig}`)).toBeNull();
    expect(await verifyPass(SECRET, "session-a", `${body}.x${sig!.slice(1)}`)).toBeNull();
    expect(await verifyPass(SECRET, "session-a", undefined)).toBeNull();
    expect(await verifyPass(SECRET, "session-a", "garbage")).toBeNull();
  });
});
