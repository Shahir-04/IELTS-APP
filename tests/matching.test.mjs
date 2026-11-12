import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filenameTrack,
  pageTracks,
  trackReferences,
} from "../src/matching.mjs";

test("detects track references and preserves disc identifiers", () => {
  assert.deepEqual(trackReferences("Track 01 then Audio 02. CD1 Track 03"), [
    "1",
    "2",
    "1.3",
  ]);
  assert.deepEqual(
    trackReferences("no audio numbers on this scanned page"),
    [],
  );
});
test("matches common filenames without treating arbitrary title numbers as tracks", () => {
  assert.equal(filenameTrack("Track 01 - introduction.mp3"), "1");
  assert.equal(filenameTrack("CD1 Track02.mp3"), "1.2");
  assert.equal(filenameTrack("01.mp3"), "1");
  assert.equal(filenameTrack("1.03 - conversation.m4a"), "1.3");
  assert.equal(filenameTrack("Cambridge IELTS 18.mp3"), null);
});
test("avoids matching track 10 or 1.1 when a page refers to track 1", () => {
  const tracks = ["1", "10", "1.1"].map((track) => ({
    track,
    id: track,
    pages: [],
  }));
  assert.deepEqual(
    pageTracks(tracks, "Listen to Track 01.", 1).map((track) => track.id),
    ["1"],
  );
});
test("manual page links work on scanned PDFs and alongside automatic matches", () => {
  const tracks = [
    { id: "scan", track: null, pages: [2] },
    { id: "audio", track: "1", pages: [] },
  ];
  assert.deepEqual(
    pageTracks(tracks, "", 2).map((track) => track.id),
    ["scan"],
  );
  assert.deepEqual(
    pageTracks(tracks, "Track 1", 2).map((track) => track.id),
    ["scan", "audio"],
  );
  assert.equal(pageTracks(tracks, "", 1).length, 0);
});
