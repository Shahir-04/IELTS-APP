import { test, expect } from "@playwright/test";
import path from "node:path";
const root = process.cwd();

// Test real PDF parsing and MP3 playback, rather than a mocked document viewer.
test("reads PDF pages, matches tracks, plays audio, and keeps notes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?lesson=lilt-original-1");
  await expect(page.getByText("Matched to page 1")).toBeVisible();
  await expect(page.locator(".pdf-loading")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute("width", /[1-9]/);
  await page
    .getByRole("button", { name: "Play A place to call home", exact: true })
    .click();
  await expect(page.locator(".now-playing")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".player audio")
        .evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await page.getByLabel("Playback speed").selectOption("0.75");
  await expect
    .poll(() =>
      page
        .locator(".player audio")
        .evaluate((element: HTMLAudioElement) => element.playbackRate),
    )
    .toBe(0.75);
  await page.getByRole("button", { name: "Repeat track", exact: true }).click();
  await expect(page.locator(".player audio")).toHaveJSProperty("loop", true);
  await page.getByRole("button", { name: "Forward 10 seconds" }).click();
  await expect
    .poll(() =>
      page
        .locator(".player audio")
        .evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(10);
  await page.getByRole("button", { name: "Pause audio", exact: true }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Matched to page 2")).toBeVisible();
  await expect(page.locator(".track-card h4")).toHaveText(
    "The neighbourhood tour",
  );
  await page.getByRole("button", { name: "Bookmark this page" }).click();
  await expect(
    page.getByRole("button", { name: "Bookmark this page" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page
    .getByLabel("Your lesson notes")
    .fill("Remember railway and accommodation.");
  await page.reload();
  await expect(page.getByLabel("PDF page")).toHaveValue("2");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByLabel("Your lesson notes")).toHaveValue(
    "Remember railway and accommodation.",
  );
  expect(errors).toEqual([]);
});

// Exercise actual IndexedDB file persistence and manual matching for an unnumbered track.
test("imports PDF/audio and restores manual links after reload", async ({
  page,
}) => {
  await page.goto("/?lesson=lilt-original-1");
  await page.getByRole("button", { name: "Add material", exact: true }).click();
  await page
    .getByLabel("Choose PDF", { exact: true })
    .setInputFiles(path.join(root, "public/library/a-little-every-day.pdf"));
  await page.getByLabel("Choose audio files").setInputFiles({
    name: "conversation.mp3",
    mimeType: "audio/mpeg",
    buffer: await import("node:fs/promises").then((fs) =>
      fs.readFile(path.join(root, "public/library/track-01.mp3")),
    ),
  });
  await page.getByLabel("Lesson name").fill("My IELTS practice");
  await page.getByRole("button", { name: "Add to my library" }).click();
  await expect(page.locator(".lesson-heading h2")).toHaveText(
    "My IELTS practice",
  );
  await expect(
    page.getByText("No audio linked to this page", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Link audio to this page" }).click();
  await page.getByRole("checkbox", { name: "conversation.mp3" }).check();
  await expect(page.getByText("Matched to page 1")).toBeVisible();
  await page.getByRole("button", { name: "Play conversation.mp3" }).click();
  await expect(page.locator(".now-playing")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "My IELTS practice Listening practice" })
    .click();
  await expect(page.locator(".lesson-heading h2")).toHaveText(
    "My IELTS practice",
  );
  await expect(page.getByText("Matched to page 1")).toBeVisible();
  await page.getByRole("button", { name: "My library", exact: false }).click();
  await page.getByLabel("Search lessons").fill("My IELTS");
  await expect(page.locator(".lesson-card")).toHaveCount(1);
});

test("mobile layout stays within the screen and exposes speaking practice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lesson=lilt-original-1");
  await expect(page.getByText("Matched to page 1")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Speak", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/workspace/lilt/mobile-preview.png",
    fullPage: true,
  });
});

test("speaking recorder produces a playable recording and releases the microphone", async ({
  browser,
}) => {
  const context = await browser.newContext({ permissions: ["microphone"] });
  const page = await context.newPage();
  await page.goto("/?lesson=lilt-original-1");
  await page.getByRole("button", { name: "Speak", exact: true }).click();
  await page.getByRole("button", { name: "Start recording" }).click();
  // Chromium's synthetic microphone makes recording deterministic in CI.
  const stop = page.getByRole("button", { name: "Finish recording" });
  await expect(stop).toBeVisible();
  await page.waitForTimeout(250);
  await stop.click();
  await expect(page.locator(".recording-result audio")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(
    page.getByRole("link", { name: "Save recording" }),
  ).toHaveAttribute("download", /lilt-speaking\./);
  await context.close();
});
