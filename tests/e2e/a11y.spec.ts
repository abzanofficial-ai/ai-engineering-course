import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const CH1 = `${COURSE}/1-python-for-ai-engineering`;

async function check(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map(
    (v) => `${label} · ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`,
  );
  expect(summary).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`signed-out screens have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(COURSE);
    await check(page, "route");
    await page.goto(CH1);
    await check(page, "learn");
    for (const mode of ["Practise", "Decide", "Review"]) {
      await page.getByRole("tab", { name: new RegExp(mode) }).click();
      await check(page, mode);
    }
    await page.goto("/sign-in");
    await check(page, "sign-in");
  });

  test(`signed-in screens have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signIn(page, newEmail(`a11y-${scheme}`), CH1);
    await page.getByRole("tab", { name: /Practise/ }).click();
    await page.getByRole("checkbox", { name: "Step 1 done" }).click();
    await check(page, "practise signed in");
    await page.getByRole("tab", { name: /Decide/ }).click();
    await page.getByRole("button", { name: "Skip and reveal" }).click();
    await check(page, "decide revealed");
    await page.goto(COURSE);
    await check(page, "route signed in");
    await page.goto("/progress");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your progress");
    await check(page, "progress");
    await page.goto("/account");
    await check(page, "account");
  });
}

test("keyboard: skip link moves focus to main content", async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.goto(CH1);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("reduced motion disables smooth scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(CH1);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    "auto",
  );
});
