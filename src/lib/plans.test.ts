import { describe, expect, it } from "vitest";
import { hashJoinCode, newJoinCode, normaliseJoinCode } from "@/server/join-code";
import {
  decideAccess,
  isFreeTierPage,
  licenceInvoice,
  money,
  plans,
  seatPackPrice,
  yearlySaving,
} from "./plans";

describe("price list", () => {
  it("loads and validates content/plans.json", () => {
    expect(plans.direct.map((p) => p.code)).toEqual(["direct-monthly", "direct-annual"]);
    expect(money(1500)).toBe("£15");
    expect(money(599)).toBe("£5.99");
    expect(money(12950)).toBe("£129.50");
  });

  it("yearly saving compares the annual plan with twelve monthly payments", () => {
    const sub = (interval: "month" | "year", pricePence: number) => ({
      code: interval,
      label: interval,
      kind: "subscription" as const,
      interval,
      pricePence,
    });
    expect(yearlySaving([sub("month", 599), sub("year", 2400)])).toBe(66);
    expect(yearlySaving([sub("month", 1000), sub("year", 12000)])).toBeNull();
    expect(yearlySaving([sub("month", 1000), sub("year", 15000)])).toBeNull();
    expect(yearlySaving([sub("year", 2400)])).toBeNull();
    expect(yearlySaving()).toBe(66);
  });

  it("centre licence: base fee covers the included learners, then a fee per extra learner", () => {
    const l = { basePence: 30000, includedLearners: 30, extraLearnerPence: 600 };
    expect(licenceInvoice(0, l)).toMatchObject({ extra: 0, total: 30000 });
    expect(licenceInvoice(30, l)).toMatchObject({ extra: 0, total: 30000 });
    expect(licenceInvoice(45, l)).toMatchObject({ extra: 15, extraPence: 9000, total: 39000 });
  });

  it("seat packs: the tier for the pack size applies to every seat", () => {
    const tiers = [
      { minSeats: 1, pencePerSeat: 6000 },
      { minSeats: 50, pencePerSeat: 5000 },
      { minSeats: 200, pencePerSeat: 4000 },
    ];
    expect(seatPackPrice(10, tiers)).toEqual({ pencePerSeat: 6000, total: 60000 });
    expect(seatPackPrice(50, tiers)).toEqual({ pencePerSeat: 5000, total: 250000 });
    expect(seatPackPrice(250, tiers).pencePerSeat).toBe(4000);
    expect(() => seatPackPrice(0, tiers)).toThrow();
    expect(() => seatPackPrice(2.5, tiers)).toThrow();
  });
});

describe("join codes", () => {
  it("are 12 unambiguous characters in three groups and unique in practice", () => {
    const codes = new Set(Array.from({ length: 2000 }, newJoinCode));
    expect(codes.size).toBe(2000);
    for (const c of [...codes].slice(0, 50))
      expect(c).toMatch(/^[2-9A-HJKMNP-TV-Z]{4}(-[2-9A-HJKMNP-TV-Z]{4}){2}$/);
  });
  it("hash the same however the learner types them", () => {
    expect(normaliseJoinCode(" abcd-efgh 2345 ")).toBe("ABCDEFGH2345");
    expect(hashJoinCode("abcd efgh-2345")).toBe(hashJoinCode("ABCD-EFGH-2345"));
    expect(hashJoinCode("ABCD-EFGH-2345")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("decideAccess", () => {
  const base = {
    isPublic: false,
    signedIn: true,
    launchOpen: false,
    licenceActive: false,
    membershipActive: true,
    entitled: false,
    isFreeTier: false,
  };
  it("applies the rules in order", () => {
    expect(decideAccess({ ...base, isPublic: true, signedIn: false })).toEqual({
      allowed: true,
      via: "public",
    });
    expect(decideAccess({ ...base, signedIn: false })).toEqual({
      allowed: false,
      reason: "sign-in",
    });
    expect(decideAccess({ ...base, launchOpen: true })).toEqual({ allowed: true, via: "launch" });
    expect(decideAccess({ ...base, licenceActive: true })).toEqual({
      allowed: true,
      via: "licence",
    });
    expect(decideAccess({ ...base, licenceActive: true, membershipActive: false })).toEqual({
      allowed: false,
      reason: "plans",
    });
    expect(decideAccess({ ...base, entitled: true })).toEqual({
      allowed: true,
      via: "entitlement",
    });
    expect(decideAccess({ ...base, isFreeTier: true })).toEqual({ allowed: true, via: "free" });
    expect(decideAccess(base)).toEqual({ allowed: false, reason: "plans" });
  });
  it("reads free-tier patterns", () => {
    const free = ["start-*", "part:1"];
    expect(isFreeTierPage(free, "start-how-to-use-this-book", 0)).toBe(true);
    expect(isFreeTierPage(free, "ch-3", 1)).toBe(true);
    expect(isFreeTierPage(free, "ch-9", 2)).toBe(false);
  });
});
