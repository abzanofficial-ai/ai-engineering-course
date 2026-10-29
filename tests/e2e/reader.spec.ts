import { expect, test } from "@playwright/test";

const COURSE = "/learn/ai-engineering-handbook";
const CH1 = `${COURSE}/1-python-for-ai-engineering`;
const CH17 = `${COURSE}/17-embeddings-vector-databases-and-similarity-search`;

test("root redirects to the course home, which lists parts and coming-soon chapters", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(COURSE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The AI Engineering Handbook");
  await expect(
    page.getByRole("heading", { name: "Part 1 — Programming Foundation" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Python for AI Engineering/ })).toBeVisible();
  // Coming-soon chapters are listed as text, not links.
  const ch31 = page.getByText("Eval-driven development");
  await expect(ch31).toBeVisible();
  await expect(page.getByRole("link", { name: /Eval-driven development/ })).toHaveCount(0);
});

test("chapter reader: definition, sections, steps, prev/next", async ({ page }) => {
  await page.goto(CH1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Python for AI Engineering");
  await expect(page.getByText(/general-purpose programming language/).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Jargon decoder" })).toBeVisible();
  await expect(page.locator("[data-step]")).toHaveCount(8);
  await page.getByRole("link", { name: /Next →/ }).click();
  await expect(page).toHaveURL(/2-git-and-github$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Git & GitHub");
});

test("table of contents jumps to a section", async ({ page, isMobile }) => {
  await page.goto(CH1);
  if (isMobile) await page.getByText("On this page").first().click();
  const toc = isMobile
    ? page.locator("details", { hasText: "On this page" })
    : page.getByRole("complementary", { name: "On this page" });
  await toc.getByRole("link", { name: "Decision drill: the overnight job" }).click();
  await expect(page).toHaveURL(/#drill$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Decision drill: the overnight job" }),
  ).toBeInViewport();
});

test("copy button copies shell commands without the $ prompt", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(CH1);
  const block = page
    .locator('figure.code[data-copy-mode="shell"]', { hasText: "mkdir 01-python" })
    .first();
  await block.getByRole("button", { name: "Copy bash code" }).click();
  await expect(block.getByRole("button")).toHaveText("Copied");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith("$")).toBe(false);
  expect(text).toContain("mkdir 01-python");
});

test("diagrams render as images with alt text and a text alternative", async ({ page }) => {
  await page.goto(CH17);
  const fig = page.locator("figure.diagram").first();
  await fig.scrollIntoViewIfNeeded();
  const img = fig.locator("img.diagram-light");
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("alt", /Flowchart/);
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await fig.getByText("Diagram as text").click();
  await expect(fig.locator("details p")).toContainText("SAME embedding model");
});

test("theme toggle switches to dark and persists across reloads", async ({ page }) => {
  await page.goto(CH17);
  const toggle = page.getByRole("button", { name: /^Theme:/ });
  await toggle.click(); // system → light
  await toggle.click(); // light → dark
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("figure.diagram").first().scrollIntoViewIfNeeded();
  await expect(page.locator("figure.diagram img.diagram-dark").first()).toBeVisible();
  await expect(page.locator("figure.diagram img.diagram-light").first()).toBeHidden();
});

test("stuck prompts highlight placeholders", async ({ page }) => {
  await page.goto(`${CH1}#stuck`);
  await expect(page.locator("#stuck mark.placeholder").first()).toHaveText("[paste full error]");
});

test("no horizontal page scroll", async ({ page }) => {
  for (const url of [COURSE, CH1, CH17]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});

test("security headers are present", async ({ request }) => {
  const res = await request.get(CH1);
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});
