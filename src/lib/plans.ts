// The commercial model's numbers (ADR-0030), from content/plans.json. Pure, so the plans page,
// the admin screen and the tests share one calculation.
import { z } from "zod";
import file from "../../content/plans.json";

const pence = z.number().int().nonnegative();
const schema = z.object({
  currency: z.literal("GBP"),
  note: z.string(),
  direct: z
    .array(
      z.object({
        code: z.string(),
        label: z.string(),
        kind: z.enum(["subscription", "one_off"]),
        interval: z.enum(["month", "year"]).optional(),
        pricePence: pence,
        /** Short label shown on the card, e.g. a launch price. */
        badge: z.string().optional(),
        /** The plan to steer learners to. */
        highlight: z.boolean().optional(),
      }),
    )
    .min(1),
  centreLicence: z.object({
    code: z.string(),
    label: z.string(),
    basePence: pence,
    includedLearners: z.number().int().nonnegative(),
    extraLearnerPence: pence,
    setupPence: pence,
  }),
  seatPack: z.object({
    code: z.string(),
    label: z.string(),
    accessMonths: z.number().int().min(1).max(60),
    tiers: z
      .array(z.object({ minSeats: z.number().int().min(1), pencePerSeat: pence }))
      .min(1)
      .refine((t) => t[0]!.minSeats === 1, "the first tier must start at 1 seat"),
  }),
});

export type Plans = z.infer<typeof schema>;
export const plans: Plans = schema.parse(file);

export const money = (p: number) =>
  `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** How much a yearly plan saves against twelve months of the monthly plan, in whole percent. */
export function yearlySaving(direct: Plans["direct"] = plans.direct): number | null {
  const month = direct.find((p) => p.kind === "subscription" && p.interval === "month");
  const year = direct.find((p) => p.kind === "subscription" && p.interval === "year");
  if (!month || !year || month.pricePence === 0) return null;
  const pct = Math.floor((1 - year.pricePence / (month.pricePence * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** A centre licence's monthly invoice for a number of active learners. */
export function licenceInvoice(
  activeLearners: number,
  l: Pick<
    Plans["centreLicence"],
    "basePence" | "includedLearners" | "extraLearnerPence"
  > = plans.centreLicence,
) {
  const extra = Math.max(0, activeLearners - l.includedLearners);
  return {
    base: l.basePence,
    extra,
    extraPence: extra * l.extraLearnerPence,
    total: l.basePence + extra * l.extraLearnerPence,
  };
}

/** Price of a seat pack: the tier for the pack size applies to every seat in it. */
export function seatPackPrice(seats: number, tiers = plans.seatPack.tiers) {
  if (!Number.isInteger(seats) || seats < 1)
    throw new Error("seats must be a positive whole number");
  const tier = [...tiers].sort((a, b) => b.minSeats - a.minSeats).find((t) => seats >= t.minSeats)!;
  return { pencePerSeat: tier.pencePerSeat, total: tier.pencePerSeat * seats };
}

export type AccessVia = "public" | "launch" | "licence" | "entitlement" | "free";
export type AccessDecision =
  { allowed: true; via: AccessVia } | { allowed: false; reason: "sign-in" | "plans" };

/** Free-tier patterns from tenant config: page keys (`*` suffix wildcard) or "part:N". */
export function isFreeTierPage(patterns: string[], pageKey: string, partNumber: number): boolean {
  return patterns.some((p) =>
    p.startsWith("part:")
      ? Number(p.slice(5)) === partNumber
      : p.endsWith("*")
        ? pageKey.startsWith(p.slice(0, -1))
        : p === pageKey,
  );
}

/** The one access rule (ADR-0030), in order. */
export function decideAccess(i: {
  isPublic: boolean;
  signedIn: boolean;
  launchOpen: boolean;
  licenceActive: boolean;
  membershipActive: boolean;
  entitled: boolean;
  isFreeTier: boolean;
}): AccessDecision {
  if (i.isPublic) return { allowed: true, via: "public" };
  if (!i.signedIn) return { allowed: false, reason: "sign-in" };
  if (i.launchOpen) return { allowed: true, via: "launch" };
  if (i.licenceActive && i.membershipActive) return { allowed: true, via: "licence" };
  if (i.entitled) return { allowed: true, via: "entitlement" };
  if (i.isFreeTier) return { allowed: true, via: "free" };
  return { allowed: false, reason: "plans" };
}
