import { get, set } from "idb-keyval";
import type { Lesson, Progress } from "./types";
const LIBRARY_KEY = "lilt-library-v1";
/** Restore imported files from browser storage, including their binary blobs. */
export async function loadLibrary(): Promise<Lesson[]> {
  return (await get(LIBRARY_KEY)) ?? [];
}
/** Persist only user lessons; the bundled lesson is always available separately. */
export async function saveLibrary(lessons: Lesson[]) {
  await set(
    LIBRARY_KEY,
    lessons.filter((lesson) => !lesson.demo && !lesson.bundled),
  );
}
/** Read progress defensively so a malformed browser entry cannot break the app. */
export function loadProgress(id: string, startPage = 1): Progress {
  try {
    return {
      page: startPage,
      notes: "",
      completed: false,
      answers: {},
      ...JSON.parse(localStorage.getItem(`lilt-progress-${id}`) ?? "{}"),
    };
  } catch {
    return { page: startPage, notes: "", completed: false, answers: {} };
  }
}
/** Save reading position, practice notes, and answers on this device. */
export function saveProgress(id: string, progress: Progress) {
  localStorage.setItem(`lilt-progress-${id}`, JSON.stringify(progress));
}
