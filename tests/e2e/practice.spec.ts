// M3: part checkpoints, the review queue, the Sections menu and previous/next chapters.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { COURSE, newEmail, signIn } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgres://lms:lms_local_only@localhost:5432/lms_e2e";
const ANSWER = "I would ask whether it runs once or every week, then batch it overnight.";

test("part checkpoint: pass, earn XP, see it on the route; unsure questions join review", async ({
  page,
}) => {
  const email = newEmail("checkpoint");
  await signIn(page, email, `${COURSE}/checkpoint/1`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Programming Foundation");
  await page.getByRole("button", { name: "Start checkpoint" }).click();
  const total = Number(
    (await page.locator(".flash .card-kicker").textContent())!.match(/of (\d+)/)![1],
  );
  await page.getByRole("button", { name: "Unsure" }).click(); // one unsure → 90%
  for (let i = 1; i < total; i++) await page.getByRole("button", { name: "Confident" }).click();
  const finish = page.getByRole("button", { name: "Finish checkpoint" });
  await expect(finish).toBeDisabled();
  await page.getByLabel("Your answer").fill(ANSWER);
  await finish.click();
  await expect(page.getByRole("heading", { name: "Checkpoint passed" })).toBeVisible();
  await expect(page.locator(".toast")).toHaveText("+200 XP");
  await expect(page.getByText("To revisit (1)")).toBeVisible();
  expect(
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
      .then((r) =>
        r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
      ),
  ).toEqual([]);

  await page.goto(COURSE);
  await expect(page.getByRole("link", { name: /Part 1 checkpoint/ })).toContainText(
    "Passed · best 90% confident",
  );

  // The unsure question is due tomorrow; make it due now and review it.
  const sql = postgres(DB, { max: 1 });
  await sql`update card_review set due_at = now() - interval '1 minute' where user_id = (select id from "user" where email = ${email})`;
  await sql.end();
  await page.reload();
  await page.getByRole("link", { name: /1 question to review/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review due");
  await expect(page.locator(".tally")).toContainText("1 due");
  expect(
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
      .then((r) =>
        r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
      ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Confident" }).click();
  await expect(page.getByText("All caught up: 1 reviewed.")).toBeVisible();
});

test("checkpoints and review need an account", async ({ page }) => {
  await page.goto(`${COURSE}/checkpoint/1`);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.goto("/review");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Freview/);
});

test("Sections menu jumps anywhere in the chapter, by mouse and keyboard", async ({ page }) => {
  await page.goto(`${COURSE}/1-python-for-ai-engineering`);
  const toggle = page.getByRole("button", { name: /Sections/ });
  await expect(toggle).toContainText("Key terms");
  await toggle.click();
  await page.locator("#sections-panel").getByRole("button", { name: "What it is" }).click();
  await expect(page.locator("#learn-title")).toHaveText("What it is");
  await expect(page.locator("#sections-panel")).toBeHidden();

  await toggle.click();
  await page
    .locator("#sections-panel")
    .getByRole("button", { name: /Decision drill/ })
    .click();
  await expect(page.getByRole("tab", { name: /Decide/ })).toHaveAttribute("aria-selected", "true");

  await toggle.click();
  await expect(page.locator("#sections-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#sections-panel")).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("previous and next chapter links", async ({ page }) => {
  await page.goto(`${COURSE}/1-python-for-ai-engineering`);
  await expect(page.getByRole("link", { name: /Previous/ })).toContainText("The capstone");
  await expect(page.getByRole("link", { name: /Up next/ })).toContainText("Git & GitHub");
});
