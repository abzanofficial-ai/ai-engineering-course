import { expect, test } from "@playwright/test";
import { COURSE } from "./helpers";

const CH1 = `${COURSE}/1-python-for-ai-engineering`;

// Home and the course are one tap away from anywhere: a bottom tab bar on phones, header links
// on wider screens.
test("Home and Course are reachable from a chapter", async ({ page, isMobile }) => {
  await page.goto(CH1);
  const nav = page.getByRole("navigation", {
    name: isMobile ? "Main (bottom)" : "Main",
    exact: true,
  });
  await expect(nav).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: isMobile ? "Main" : "Main (bottom)", exact: true }),
  ).toBeHidden();
  await expect(nav.getByRole("link", { name: "Course" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Course" }).click();
  await expect(page).toHaveURL(COURSE);
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Home" })
    .click();
  await expect(page).toHaveURL(/\/$/);
});

test("the bottom bar never covers the end of the page on phones", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto(COURSE);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footer = page.locator("footer").first();
  const bar = page.getByRole("navigation", { name: "Main (bottom)" });
  const [f, b] = [await footer.boundingBox(), await bar.boundingBox()];
  expect(f!.y + f!.height).toBeLessThanOrEqual(b!.y + 1);
});
