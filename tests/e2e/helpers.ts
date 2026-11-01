import { readFileSync, existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

const MAIL_FILE = ".cache/e2e-mail.jsonl";
export const COURSE = "/learn/ai-engineering-handbook";

/** A unique synthetic learner per test (never real data). */
export function newEmail(tag: string): string {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

async function magicLinkFor(email: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    if (existsSync(MAIL_FILE)) {
      const lines = readFileSync(MAIL_FILE, "utf8").trim().split("\n").filter(Boolean);
      const mail = lines
        .map((l) => JSON.parse(l) as { to: string; text: string })
        .reverse()
        .find((m) => m.to === email);
      if (mail) return mail.text.match(/https?:\/\/\S+/)![0];
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no magic link for ${email}`);
}

/** Signs up/in through the real UI and the emailed link. */
export async function signIn(page: Page, email: string, next = COURSE) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await magicLinkFor(email));
  await expect(page.getByRole("link", { name: /Your progress/ })).toBeVisible();
}
