import { describe, expect, it } from "vitest";
import { clean, DIRECT, referrerSource, sourceFrom, sourceSchema, withSource } from "./attribution";

const q = (s: string) => new URLSearchParams(s);
const HOST = "handbook.example";

describe("attribution", () => {
  it("UTM parameters win and are normalised", () => {
    expect(
      sourceFrom(
        q("utm_source=LinkedIn&utm_medium=Social Post&utm_campaign=Launch_Week!"),
        null,
        HOST,
      ),
    ).toEqual({ source: "linkedin", medium: "social-post", campaign: "launch_week" });
    expect(clean("x".repeat(80))).toHaveLength(40);
    expect(clean("<script>")).toBe("script");
  });

  it("without UTM, the referring site is the source", () => {
    expect(sourceFrom(q(""), "https://www.linkedin.com/feed/", HOST)).toEqual({
      source: "linkedin.com",
      medium: "referral",
      campaign: "",
    });
    expect(referrerSource("https://lnkd.in/abc", HOST)?.source).toBe("linkedin.com");
    expect(referrerSource("https://t.co/xyz", HOST)?.source).toBe("x.com");
    expect(referrerSource("https://l.facebook.com/l.php", HOST)?.source).toBe("facebook.com");
    expect(referrerSource("https://www.google.co.uk/", HOST)).toEqual({
      source: "google",
      medium: "organic",
      campaign: "",
    });
  });

  it("our own pages, missing or broken referrers count as direct", () => {
    expect(sourceFrom(q(""), `https://${HOST}/plans`, HOST)).toEqual(DIRECT);
    expect(sourceFrom(q(""), "", HOST)).toEqual(DIRECT);
    expect(sourceFrom(q(""), "not a url", HOST)).toEqual(DIRECT);
    expect(sourceFrom(q("utm_source=%20%20"), null, HOST)).toEqual(DIRECT);
  });

  it("withSource carries the source on internal links, and not for direct visits", () => {
    const s = { source: "meta", medium: "paid", campaign: "founders" };
    expect(withSource("/learn/x?mode=lab#s", s)).toBe(
      "/learn/x?mode=lab&utm_source=meta&utm_medium=paid&utm_campaign=founders#s",
    );
    expect(withSource("/learn/x", { source: "x.com", medium: "referral", campaign: "" })).toBe(
      "/learn/x?utm_source=x.com&utm_medium=referral",
    );
    expect(withSource("/learn/x", DIRECT)).toBe("/learn/x");
    expect(withSource("/learn/x", null)).toBe("/learn/x");
  });

  it("the stored shape only accepts clean values", () => {
    expect(sourceSchema.safeParse({ source: "meta", medium: "", campaign: "" }).success).toBe(true);
    expect(sourceSchema.safeParse({ source: "", medium: "", campaign: "" }).success).toBe(false);
    expect(sourceSchema.safeParse({ source: "Meta", medium: "", campaign: "" }).success).toBe(
      false,
    );
  });
});
