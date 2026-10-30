// Offline tolerance (ADR-0009, ADR-0022): ticks made offline survive a reload and sync later.
import { expect, test } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

const CH3 = `${COURSE}/3-apis-and-json`;

test("progress made offline is kept and synced when back online", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, "one run is enough");
  await signIn(page, newEmail("offline"), CH3);
  // Let the service worker take control and cache this chapter.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForLoadState("networkidle");

  await context.setOffline(true);
  await page.getByRole("tab", { name: /Practise/ }).click();
  await page.getByRole("checkbox", { name: "Step 1 done" }).click();
  await expect(page.locator(".save-status:visible").first()).toHaveText("Offline: will sync");

  // Reload while offline: the chapter comes from the cache and the tick from the outbox.
  await page.reload();
  await page.getByRole("tab", { name: /Practise/ }).click();
  await expect(page.getByRole("checkbox", { name: "Step 1 done" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/me/state?course=ai-engineering-handbook`);
        const body = await res.json();
        return body.state.steps["ch-3"]?.lab ?? [];
      },
      { timeout: 15_000 },
    )
    .toContain("step-1");
});
