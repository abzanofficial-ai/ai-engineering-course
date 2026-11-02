import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newEmail, signIn } from "./helpers";

// The flags screen is checked without switching anything: e2e tests run in parallel against one
// server, and launch mode affects every learner. Switching is covered in tests/integration/flags.
test("the owner sees each flag with its state, default and actions", async ({ page, isMobile }) => {
  test.skip(isMobile, "an admin task done on a computer");
  await signIn(page, "owner@example.test", "/admin/flags");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Feature flags");
  await expect(page.getByRole("link", { name: "Feature flags" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const launch = page.getByRole("region", { name: /Launch mode/ });
  await expect(launch).toContainText("launch_open_access");
  await expect(launch).toContainText("default on");
  await expect(launch.getByRole("button", { name: "Turn off" })).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("learners are not shown the flags screen", async ({ page }) => {
  await signIn(page, newEmail("not-owner"), "/home");
  const res = await page.goto("/admin/flags");
  expect(res?.status()).toBe(404);
});
