import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { newEmail, signIn } from "./helpers";

const edited = readFileSync("content/handbook.md", "utf8")
  .replace("A readable, forgiving language", "A readable, forgiving and popular language")
  .replace("- How would you handle 100 concurrent LLM requests?\n", "");

test("owner previews a new handbook export and is shown how to publish it", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "an admin task done on a computer");
  test.setTimeout(120_000);
  await signIn(page, "owner@example.test", "/admin/content");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Content");
  await page.getByLabel("Handbook file (.md)").setInputFiles({
    name: "handbook.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(edited),
  });
  await page.getByRole("button", { name: "Preview changes" }).click();
  const diff = page.getByRole("region", { name: "2. What would change" });
  await expect(diff).toContainText("Python for AI Engineering (ch-1)", { timeout: 60_000 });
  await expect(diff).toContainText("Edited pages (1)");
  await expect(diff).toContainText("2 section(s) edited, 1 question(s) removed");
  await expect(diff).toContainText("Removed items learners may have progress on");

  const publish = page.getByRole("button", { name: "Publish" });
  await expect(publish).toBeDisabled();
  await page.getByLabel(/I understand 1 item\(s\)/).check();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await publish.click();
  await expect(page.locator(".error")).toContainText("Publishing to GitHub isn't set up");
  await expect(page.locator(".error")).toContainText("pnpm content:diff content/handbook.md");

  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Access and centres" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Access and centres");
});

test("learners can't see the content screen", async ({ page }) => {
  await signIn(page, newEmail("nosy-content"), "/home");
  expect((await page.goto("/admin/content"))!.status()).toBe(404);
});
