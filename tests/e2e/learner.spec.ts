// A signed-in learner's journey: progress in every mode, XP, streak, goal, account.
import { expect, test } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

const CH2 = `${COURSE}/2-git-and-github`;

test("learn, practise, decide and review: progress and XP are saved to the account", async ({
  page,
}) => {
  await signIn(page, newEmail("journey"), CH2);
  await expect(page).toHaveURL(CH2);

  // Learn: reading a section earns 5 XP.
  await page.getByRole("button", { name: "Got it · next" }).click();
  await expect(page.locator(".toast")).toHaveText("+5 XP");

  // Practise: tick a step (+10) and confirm the commit (+50).
  await page.getByRole("tab", { name: /Practise/ }).click();
  await page.getByRole("checkbox", { name: "Step 1 done" }).click();
  await expect(page.getByRole("checkbox", { name: "Step 1 done" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "I committed it" }).click();
  await expect(page.getByText("Committed.", { exact: true })).toBeVisible();

  // Decide: the reasoning stays hidden until the learner writes an answer.
  await page.getByRole("tab", { name: /Decide/ }).click();
  const compare = page.getByRole("button", { name: "Compare with an experienced engineer" });
  await expect(compare).toBeDisabled();
  await page
    .getByLabel(/Your answer/)
    .fill("I would ask who owns the repository and the accounts first.");
  await compare.click();
  await expect(page.getByText("How an experienced engineer reasons")).toBeVisible();
  await expect(page.locator(".yours")).toContainText("who owns the repository");

  // Review: rate a flashcard.
  await page.getByRole("tab", { name: /Review/ }).click();
  await page.getByRole("button", { name: "Confident" }).click();
  await expect(page.locator(".tally")).toContainText("Confident 1");
  await expect(page.locator(".save-status:visible")).toHaveText("Saved", { timeout: 10_000 });

  // Everything survives a reload (it came from the server, not the page).
  await page.reload();
  await page.getByRole("tab", { name: /Practise/ }).click();
  await expect(page.getByRole("checkbox", { name: "Step 1 done" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("tab", { name: /Practise/ })).toContainText("1/9 steps");

  // Progress page: 5 + 10 + 50 + 30 + 5 = 100 XP, a 1-day streak, and the goal can change.
  await page.getByRole("link", { name: /Your progress/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your progress");
  await expect(page.locator(".big").nth(1)).toHaveText("100");
  await expect(page.getByText("Done today.")).toBeVisible();
  await page.getByRole("button", { name: "More days" }).click();
  await expect(page.getByText("1 of 4 days this week")).toBeVisible();

  // The route continues where the learner left off.
  await page.goto(COURSE);
  await expect(page.getByRole("link", { name: /Continue where you left off/ })).toContainText(
    "Git & GitHub",
  );
});

test("account: rename, export, sign out, delete", async ({ page }) => {
  const email = newEmail("account");
  await signIn(page, email, "/account");
  await page.getByLabel("Name on your certificates").fill("Sam Patel");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download my data" }).click();
  const file = await (await download).path();
  const data = JSON.parse((await import("node:fs")).readFileSync(file, "utf8"));
  expect(data.profile).toMatchObject({ email, name: "Sam Patel" });

  const del = page.getByRole("button", { name: "Delete my account" });
  await expect(del).toBeDisabled();
  await page.getByLabel("Type your email address to confirm").fill(email);
  await del.click();
  // The dashboard confirms the deletion once, then tidies "?deleted=1" out of the address.
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Your account and all your learning data have been deleted." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/home(\?deleted=1)?$/);
  expect((await page.request.get("/api/me/state?course=ai-engineering-handbook")).status()).toBe(
    401,
  );
});
