// Seat-pack join codes (ADR-0030). No 0/O, 1/I/L or U, so they are easy to read out and type.
// 30^12 ≈ 2^59. Only the hash is stored.
import { createHash, randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newJoinCode(): string {
  const c = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

/** Case, spaces and dashes don't matter when a learner types a code. */
export const normaliseJoinCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const hashJoinCode = (code: string) =>
  createHash("sha256").update(normaliseJoinCode(code)).digest("hex");
