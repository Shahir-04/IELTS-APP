import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { pageTracks } from "../src/matching.mjs";
const pages = JSON.parse(
  readFileSync(new URL("../src/books/cambridge-pages.json", import.meta.url)),
);

test("all 70 publisher tracks are mapped to valid physical PDF pages", () => {
  assert.equal(Object.keys(pages).length, 70);
  for (let number = 1; number <= 70; number++) {
    assert.ok(pages[number].length > 0, `Track ${number} has no page`);
    assert.ok(
      pages[number].every(
        (page) => Number.isInteger(page) && page >= 1 && page <= 398,
      ),
    );
  }
});
test("scanned page mappings handle multiple tracks and section continuation pages", () => {
  const tracks = Object.entries(pages).map(([track, pages]) => ({
    track,
    pages,
  }));
  assert.deepEqual(
    pageTracks(tracks, "www.ieltsportal.com", 17).map((track) => track.track),
    ["3", "4"],
  );
  assert.deepEqual(
    pageTracks(tracks, "", 151).map((track) => track.track),
    ["34", "35"],
  );
  assert.deepEqual(
    pageTracks(tracks, "", 157).map((track) => track.track),
    ["40"],
  );
  assert.deepEqual(pageTracks(tracks, "", 283), []);
  assert.deepEqual(
    pageTracks(tracks, "", 302).map((track) => track.track),
    ["70"],
  );
});
test("verified PDF and every publisher MP3 are present in the generated library", () => {
  assert.equal(
    statSync(new URL("../public/library/cambridge/guide.pdf", import.meta.url))
      .size,
    65553206,
  );
  for (let number = 1; number <= 70; number++)
    assert.ok(
      statSync(
        new URL(
          `../public/library/cambridge/track-${String(number).padStart(2, "0")}.mp3`,
          import.meta.url,
        ),
      ).size > 1000,
    );
});
