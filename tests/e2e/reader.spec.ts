// Signed-out visitors: public pages, gating, the route and the four modes.
import { expect, test } from "@playwright/test";
import { COURSE } from "./helpers";

const CH1 = `${COURSE}/1-python-for-ai-engineering`;
const CAPSTONE = `${COURSE}/the-capstone-what-you-re-building-across-the-whole-book`;

test("root opens the route: parts with outcomes, milestones and coming-soon chapters", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(COURSE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The AI Engineering Handbook");
  await expect(
    page.getByRole("heading", { name: "Part 1 · Programming Foundation" }),
  ).toBeVisible();
  await expect(page.getByText("You can now: Build and ship working software")).toBeVisible();
  await expect(page.locator(".flag")).toHaveCount(2);
  await expect(page.getByText("Eval-driven development")).toBeVisible();
  await expect(page.getByRole("link", { name: /Eval-driven development/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Start here/ })).toBeVisible();
});

test("chapter 1 is public: definition, tabs, one Learn card at a time", async ({ page }) => {
  await page.goto(CH1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Python for AI Engineering");
  await expect(page.getByText(/^The general-purpose programming language/)).toBeVisible();
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveText([/Learn/, /Practise/, /Decide/, /Review/]);
  await expect(page.locator("article.card:visible")).toHaveCount(1);
  await expect(page.locator("#learn-title")).toHaveText("Jargon decoder");
  await page.getByRole("button", { name: /^Library/ }).click();
  await expect(page.getByText("Someone else's code you install and use")).toBeVisible();
  await page.getByRole("button", { name: "Got it · next" }).click();
  await expect(page.locator("#learn-title")).toHaveText("What it is");
  await expect(page.locator(".account-prompt")).toHaveCount(0); // reading needs no account
});

test("keyboard: arrow keys move between mode tabs", async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.goto(CH1);
  await page.getByRole("tab", { name: /Learn/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Practise/ })).toBeFocused();
  await expect(page.getByRole("tab", { name: /Practise/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#panel-practise")).toBeVisible();
});

test("saving needs an account: ticking a step offers sign-up", async ({ page }) => {
  await page.goto(CH1);
  await page.getByRole("tab", { name: /Practise/ }).click();
  await page.getByRole("checkbox", { name: "Step 1 done" }).click();
  await expect(page.getByRole("dialog", { name: "Save your progress" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create free account" })).toHaveAttribute(
    "href",
    /sign-in\?next=/,
  );
});

test("other chapters require sign-in and come back afterwards", async ({ page }) => {
  await page.goto(`${COURSE}/2-git-and-github`);
  await expect(page).toHaveURL(
    /\/sign-in\?next=%2Flearn%2Fai-engineering-handbook%2F2-git-and-github/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Sign in or create your free account",
  );
});

test("deep links open the right mode", async ({ page }) => {
  await page.goto(`${CH1}#drill`);
  await expect(page.getByRole("tab", { name: /Decide/ })).toHaveAttribute("aria-selected", "true");
  await page.goto(`${CH1}#what-it-is`);
  await expect(page.locator("#learn-title")).toHaveText("What it is");
});

test("copy button copies shell commands without the $ prompt", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(CH1);
  await page.getByRole("tab", { name: /Practise/ }).click();
  const block = page.locator('figure.code[data-copy-mode="shell"]:visible').first();
  await block.getByRole("button", { name: "Copy bash code" }).click();
  await expect(block.getByRole("button")).toHaveText("Copied");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith("$")).toBe(false);
  expect(text.length).toBeGreaterThan(0);
});

test("diagrams render with alt text, a text version, and switch with the theme", async ({
  page,
}) => {
  await page.goto(CAPSTONE);
  for (let i = 0; i < 6 && !(await page.locator("figure.diagram:visible").count()); i++) {
    await page.getByRole("button", { name: /Got it · next|Mark as read/ }).click();
  }
  const fig = page.locator("figure.diagram:visible").first();
  await expect(fig.locator("img.diagram-light")).toHaveAttribute("alt", /Flowchart/);
  await fig.getByText("Diagram as text").click();
  await expect(fig.locator("details p")).not.toBeEmpty();
  const toggle = page.getByRole("button", { name: /^Theme:/ });
  await toggle.click();
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(fig.locator("img.diagram-dark")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("no horizontal page scroll", async ({ page }) => {
  for (const url of [COURSE, CH1, CAPSTONE, "/sign-in"]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});

test("security headers and the web app manifest", async ({ request }) => {
  const h = (await request.get(CH1)).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  expect((await request.get("/api/me/state?course=ai-engineering-handbook")).status()).toBe(401);
});
