import type { Lesson } from "../types";
import pageMap from "./cambridge-pages.json";

export const CAMBRIDGE_ID = "official-cambridge-guide-ielts";

/** Name the verified publisher track sequence without confusing exercise and track numbers. */
function trackTitle(number: number) {
  if (number === 1) return "Listening · Introduction";
  if (number >= 39)
    return `Practice Test ${Math.floor((number - 39) / 4) + 1} · Section ${((number - 39) % 4) + 1}`;
  if (number >= 34) return `Speaking · Track ${number}`;
  const units = [
    [7, 1],
    [12, 2],
    [15, 3],
    [19, 4],
    [22, 5],
    [26, 6],
    [30, 7],
    [33, 8],
  ];
  const unit = units.find(([last]) => number <= last)![1];
  return `Listening Unit ${unit} · Track ${String(number).padStart(2, "0")}`;
}

/** Restore optional personal page-link changes over the verified scanned-book mappings. */
export function loadCambridgeLesson(): Lesson {
  let overrides: Record<string, number[]> = {};
  try {
    overrides = JSON.parse(
      localStorage.getItem(`lilt-bundled-links-${CAMBRIDGE_ID}`) ?? "{}",
    );
  } catch {
    /* A damaged local override must not hide the bundled book. */
  }
  return {
    id: CAMBRIDGE_ID,
    title: "The Official Cambridge Guide to IELTS",
    category: "Listening",
    createdAt: "2026-11-12",
    bundled: true,
    publisher: "Cambridge University Press",
    startPage: 16,
    pdfUrl: "/library/cambridge/guide.pdf",
    tracks: Array.from({ length: 70 }, (_, index) => {
      const number = index + 1;
      const id = `cambridge-${number}`;
      return {
        id,
        name: trackTitle(number),
        track: String(number),
        pages: overrides[id] ?? pageMap[String(number) as keyof typeof pageMap],
        url: `/library/cambridge/track-${String(number).padStart(2, "0")}.mp3`,
      };
    }),
  };
}
