import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { CourseManifest } from "@/content/types";
import { partContent, seedFor, selectQuestions } from "@/lib/checkpoint";
import { specOf } from "@/lib/learner-state";
import { COURSE, newEmail, signIn } from "./helpers";

const SLUG = "ai-engineering-handbook";
const m = JSON.parse(readFileSync(`.content/${SLUG}/manifest.json`, "utf8")) as CourseManifest;
const day = () => new Date().toISOString().slice(0, 10);

/** Completes Part 1 through the real API as this (synthetic) learner, and passes its checkpoint. */
async function earnPart1(page: Page) {
  const ops: object[] = [];
  for (const p of m.pages.filter((x) => x.partNumber === 1 && x.status === "published")) {
    const s = specOf(p);
    for (const section of s.learn) ops.push({ type: "section_read", page: p.key, section, ts: 1 });
    for (const lab of s.labs) {
      for (const step of lab.steps)
        ops.push({ type: "step", page: p.key, lab: lab.key, step, done: true, ts: 1 });
      ops.push({ type: "commit", page: p.key, lab: lab.key, done: true, ts: 1 });
    }
    if (s.drill)
      ops.push({
        type: "drill",
        page: p.key,
        answer: "A considered answer.",
        revealed: true,
        ts: 1,
      });
    for (const card of s.cards) ops.push({ type: "card", card, rating: "confident", ts: 1 });
  }
  for (let i = 0; i < ops.length; i += 100) {
    const r = await page.request.post("/api/me/ops", {
      data: { course: SLUG, day: day(), ops: ops.slice(i, i + 100) },
    });
    expect(r.ok()).toBe(true);
  }
  const keys = selectQuestions(partContent(m, 1).cards, seedFor(1, 1));
  const cp = await page.request.post("/api/me/checkpoints", {
    data: {
      course: SLUG,
      part: 1,
      day: day(),
      ratings: Object.fromEntries(keys.map((k) => [k, "confident"])),
      answer: "I would choose the simplest approach that meets the need.",
    },
  });
  expect(cp.ok()).toBe(true);
}

test("earn, claim, verify publicly and delete a part certificate", async ({ page, browser }) => {
  await signIn(page, newEmail("cert"), "/certificates");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Certificates");
  const part1 = page.getByRole("listitem").filter({ hasText: "Part 1: Programming Foundation" });
  await expect(part1.getByRole("link", { name: "Keep going" })).toBeVisible();
  await expect(page.getByText("Available once every chapter is published")).toBeVisible();

  expect((await page.request.patch("/api/me", { data: { name: "Sam Patel" } })).ok()).toBe(true);
  await earnPart1(page);
  await page.reload();
  await part1.getByRole("button", { name: "Claim certificate" }).click();
  await expect(part1).toContainText("Issued");
  await expect(part1).toContainText("Sam Patel");

  await part1.getByRole("link", { name: "View certificate" }).click();
  await expect(page).toHaveURL(/\/certificates\/[A-Za-z0-9_-]{22}$/);
  const url = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sam Patel");
  await expect(page.getByText("Part 1: Programming Foundation").first()).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // Anyone with the link can verify it, signed out, and it says nothing else about the learner.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(url);
  await expect(stranger.getByRole("heading", { level: 1 })).toHaveText("Sam Patel");
  await expect(stranger.getByText(/@example\.test/)).toHaveCount(0);
  expect(await stranger.locator('meta[name="robots"]').getAttribute("content")).toContain(
    "noindex",
  );

  // Deleting it makes the link stop working.
  await page.goto("/certificates");
  page.once("dialog", (d) => d.accept());
  await part1.getByRole("button", { name: "Delete" }).click();
  await expect(part1.getByRole("button", { name: "Claim certificate" })).toBeVisible();
  expect((await stranger.goto(url))!.status()).toBe(404);
});

test("signed out, the certificates list asks you to sign in; a bad id is 404", async ({ page }) => {
  await page.goto("/certificates");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcertificates/);
  expect((await page.goto("/certificates/not-a-real-certificate-id"))!.status()).toBe(404);
});

test("the dashboard links to certificates", async ({ page, isMobile }) => {
  test.skip(isMobile, "the side list shows on wide screens");
  await signIn(page, newEmail("cert-nav"), "/home");
  await page
    .getByRole("navigation", { name: "Your learning" })
    .getByRole("link", { name: "Certificates" })
    .click();
  await expect(page).toHaveURL(/\/certificates$/);
  await expect(page).not.toHaveURL(COURSE);
});
