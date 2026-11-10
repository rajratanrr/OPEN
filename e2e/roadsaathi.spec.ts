import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

const password = "Browser-QA-Strong-2026";
let evidence: Buffer;
test.beforeAll(async ({ request }) => {
  const list = await request.get("/api/v1/reports?pageSize=1");
  expect(list.ok()).toBeTruthy();
  const item = (await list.json()).items[0];
  evidence = await (
    await request.get("/api/v1/evidence/" + item.evidenceId)
  ).body();
});
async function login(page: Page, role = "Citizen") {
  await page.goto("/login");
  await page.getByRole("button", { name: role, exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    role === "Officer"
      ? /\/municipal$/
      : role === "Admin"
        ? /\/admin$/
        : /\/dashboard$/,
  );
}
async function fillReport(page: Page, name: string) {
  await page
    .getByLabel("Road photograph")
    .setInputFiles({
      name: "synthetic-road.jpg",
      mimeType: "image/jpeg",
      buffer: evidence,
    });
  await page.getByLabel("Road or landmark").fill(name);
  await page
    .getByLabel("What did you notice?")
    .fill("Synthetic browser test of the civic reporting and repair workflow.");
  await page.getByLabel("Latitude", { exact: true }).fill("30.9025");
  await page.getByLabel("Longitude", { exact: true }).fill("75.8545");
}
test("citizen submission, live map, authorization, officer repair, citizen timeline", async ({
  page,
  browser,
}) => {
  const name = "Browser QA " + randomUUID().slice(0, 8);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Browser QA Citizen");
  await page
    .getByLabel("Email address")
    .fill("qa-browser-" + randomUUID() + "@roadsaathi.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Browser." }),
  ).toBeVisible();
  await page
    .locator(".page-heading")
    .getByRole("link", { name: "Report a pothole", exact: true })
    .click();
  await fillReport(page, name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText(
      "AI is not connected yet. Your photo can still be reviewed by a municipal officer.",
    ),
  ).toBeVisible();
  await page.getByLabel("Observed severity").selectOption("HIGH");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const reportPath = new URL(page.url()).pathname;
  const response = await page.request.patch(
    "/api/v1/municipal" + reportPath + "/status",
    { headers: { "X-Roadsaathi": "1" }, data: { status: "RESOLVED" } },
  );
  expect(response.status()).toBe(403);
  await page.goto("/map");
  await page.getByLabel("Search reports by road name").fill(name);
  await expect(page.locator(".nearby-list article")).toHaveCount(1);
  await page.locator('.hazard-marker[title="' + name + '"]').click();
  await page.getByRole("link", { name: "View report →" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  const officerContext = await browser.newContext();
  const officer = await officerContext.newPage();
  await login(officer, "Officer");
  await officer.goto(reportPath);
  await officer
    .getByRole("button", { name: "Verify report", exact: true })
    .click();
  await expect(
    officer.getByRole("button", { name: "Assign repair", exact: true }),
  ).toBeVisible();
  await officer
    .getByRole("button", { name: "Assign repair", exact: true })
    .click();
  await officer
    .getByRole("button", { name: "Start repair", exact: true })
    .click();
  await officer
    .getByLabel("Repair evidence photograph")
    .setInputFiles({
      name: "synthetic-repair.jpg",
      mimeType: "image/jpeg",
      buffer: evidence,
    });
  await expect(
    officer.getByRole("heading", { name: "Repair evidence", exact: true }),
  ).toBeVisible();
  await expect(
    officer.getByRole("img", { name: "Repair completion evidence" }),
  ).toBeVisible();
  await officer
    .getByRole("button", { name: "Mark resolved", exact: true })
    .click();
  await expect(
    officer.getByRole("button", { name: "Reopen with reason", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Repair evidence", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".detail-heading .badge.resolved")).toBeVisible();
  await expect(page.locator(".timeline li")).toHaveCount(5);
  expect(errors).toEqual([]);
  await officerContext.close();
});

test("offline photo draft survives reload, reconnects and persists once", async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto("/report");
  // This suite targets the production preview; the installed app shell permits reloads offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page
    .getByRole("heading", { name: "A better road starts here." })
    .waitFor();
  await context.setOffline(true);
  const name = "Offline QA " + randomUUID().slice(0, 8);
  await fillReport(page, name);
  await page
    .getByRole("button", { name: "Save to outbox", exact: true })
    .click();
  await page.getByRole("button", { name: /Offline outbox/ }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Offline outbox/ }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await context.setOffline(false);
  const sync = page.getByRole("button", { name: "Sync reports", exact: true });
  if (await sync.isEnabled()) await sync.click();
  await expect(
    page.getByRole("heading", { name: "Your outbox is clear" }),
  ).toBeVisible();
  const result = await page.request.get(
    "/api/v1/users/me/reports?q=" + encodeURIComponent(name),
  );
  const body = await result.json();
  expect(body.total).toBe(1);
  expect(body.items[0].roadName).toBe(name);
});

test("dashboard, staff pages and 390px mobile layouts render without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await mkdir("docs/screenshots", { recursive: true });
  await expect(
    page.getByRole("heading", { name: "Your city at a glance" }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-tile:not(.leaflet-tile-loaded)")).toHaveCount(0);
  await page.screenshot({ path: "docs/screenshots/dashboard-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Hello, Aarav." }),
  ).toBeVisible();
  for (const path of [
    "/dashboard",
    "/report",
    "/my-reports",
    "/rewards",
    "/settings",
    "/monitor",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      path + " has horizontal overflow",
    ).toBeTruthy();
  }
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Hello, Aarav." })).toBeVisible();
  await expect(page.locator(".stat-card strong").first()).not.toHaveText("—");
  await page.screenshot({ path: "docs/screenshots/dashboard-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, "Officer");
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "The bigger picture." }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/municipal-analytics.png" });
  await login(page, "Admin");
  await expect(
    page.getByRole("heading", { name: "A trusted foundation." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
