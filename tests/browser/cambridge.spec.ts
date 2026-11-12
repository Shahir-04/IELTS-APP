import { test, expect } from "@playwright/test";

// Exercise actual scanned textbook pages and their supplied publisher audio.
test("Cambridge book opens with all 70 tracks, correct page links, and working audio", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?lesson=official-cambridge-guide-ielts");
  await expect(page.locator(".lesson-heading h2")).toHaveText(
    "The Official Cambridge Guide to IELTS",
  );
  await expect(page.getByLabel("PDF page")).toHaveValue("16");
  await expect(page.getByLabel("PDF page").locator("option")).toHaveCount(398);
  await expect(page.locator(".pdf-loading")).toHaveCount(0);
  await expect(page.locator(".track-card h4")).toHaveText(
    "Listening Unit 1 · Track 02",
  );
  await page
    .getByRole("button", {
      name: "Play Listening Unit 1 · Track 02",
      exact: true,
    })
    .click();
  await expect(page.locator(".now-playing")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".player audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause audio", exact: true }).click();
  await page.getByLabel("PDF page").selectOption("17");
  await expect(page.locator(".track-card h4")).toHaveText([
    "Listening Unit 1 · Track 03",
    "Listening Unit 1 · Track 04",
  ]);
  await page.getByLabel("PDF page").selectOption("151");
  await expect(page.locator(".track-card h4")).toHaveText([
    "Speaking · Track 34",
    "Speaking · Track 35",
  ]);
  await page.getByLabel("PDF page").selectOption("157");
  await expect(page.locator(".track-card h4")).toHaveText(
    "Practice Test 1 · Section 2",
  );
  // General Training reading sections must not be confused with listening sections.
  await page.getByLabel("PDF page").selectOption("283");
  await expect(page.locator(".track-card")).toHaveCount(0);
  await page.getByRole("button", { name: "All tracks 70" }).click();
  await expect(page.locator(".track-card")).toHaveCount(70);
  await page.getByLabel("Search audio tracks").fill("Practice Test 8");
  await expect(page.locator(".track-card")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Open page 302", exact: true })
    .click();
  await expect(page.getByLabel("PDF page")).toHaveValue("302");
  await expect(page.locator(".track-card h4")).toHaveText(
    "Practice Test 8 · Section 4",
  );
  await page
    .getByRole("button", {
      name: "Play Practice Test 8 · Section 4",
      exact: true,
    })
    .click();
  await expect(page.locator(".now-playing")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".player audio")
        .evaluate((audio: HTMLAudioElement) => audio.duration),
    )
    .toBeGreaterThan(60);
  expect(errors).toEqual([]);
});

test("personal links on a bundled scanned page survive reload", async ({
  page,
}) => {
  await page.goto("/?lesson=official-cambridge-guide-ielts");
  await expect(page.getByLabel("PDF page")).toHaveValue("16");
  await page.getByRole("button", { name: "Link audio to this page" }).click();
  await page
    .getByRole("checkbox", { name: "Listening Unit 1 · Track 02", exact: true })
    .uncheck();
  await expect(page.locator(".track-card")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("PDF page")).toHaveValue("16");
  await expect(page.locator(".track-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Link audio to this page" }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Listening Unit 1 · Track 02",
      exact: true,
    }),
  ).not.toBeChecked();
});
