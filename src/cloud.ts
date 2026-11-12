import { createClient } from "@supabase/supabase-js";
import type { Lesson } from "./types";
const config = import.meta.env;
export const supabase =
  config.VITE_SUPABASE_URL && config.VITE_SUPABASE_ANON_KEY
    ? createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_ANON_KEY)
    : null;

/** Surface API failures instead of presenting an upload as successfully synced. */
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Upload originals before saving metadata; failed uploads keep their local copies. */
export async function uploadLesson(lesson: Lesson): Promise<Lesson> {
  if (!supabase) throw new Error("Cloud storage has not been configured.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in before syncing your library.");
  if (!lesson.pdf) throw new Error("The original PDF is missing.");
  const oversized = [
    lesson.pdf,
    ...lesson.tracks.map((track) => track.blob),
  ].some((blob) => blob && blob.size > 50 * 1024 * 1024);
  if (oversized)
    throw new Error(
      `“${lesson.title}” contains a file larger than the 50 MB cloud limit. Your files remain saved on this device.`,
    );
  const folder = `${user.id}/${lesson.id}`;
  const pdfPath = `${folder}/document.pdf`;
  const pdfUpload = await supabase.storage
    .from("study-files")
    .upload(pdfPath, lesson.pdf, {
      upsert: true,
      contentType: "application/pdf",
    });
  check(pdfUpload.error);
  const tracks = [];
  for (const track of lesson.tracks) {
    if (!track.blob)
      throw new Error(`The original audio for ${track.name} is missing.`);
    const storagePath = `${folder}/${track.id}`;
    const result = await supabase.storage
      .from("study-files")
      .upload(storagePath, track.blob, {
        upsert: true,
        contentType: track.blob.type || "audio/mpeg",
      });
    check(result.error);
    tracks.push({
      id: track.id,
      name: track.name,
      track: track.track,
      pages: track.pages,
      storagePath,
    });
  }
  const metadata = {
    id: lesson.id,
    title: lesson.title,
    category: lesson.category,
    createdAt: lesson.createdAt,
    pdfPath,
    tracks,
    cloud: true,
    ownerId: user.id,
  };
  const result = await supabase
    .from("lessons")
    .upsert({ id: lesson.id, user_id: user.id, metadata });
  check(result.error);
  // Preserve original blobs locally; metadata contains storage paths only.
  return {
    ...lesson,
    ...metadata,
    tracks: tracks.map((track) => ({
      ...track,
      blob: lesson.tracks.find((item) => item.id === track.id)?.blob,
    })),
  };
}

/** Resolve private storage paths to temporary signed URLs on each library refresh. */
export async function loadCloudLibrary(): Promise<Lesson[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("lessons")
    .select("metadata, user_id")
    .order("created_at", { ascending: false });
  check(error);
  const lessons = [];
  for (const row of data ?? []) {
    const lesson = row.metadata as Lesson;
    const pdf = await supabase.storage
      .from("study-files")
      .createSignedUrl(lesson.pdfPath!, 60 * 60 * 24);
    check(pdf.error);
    const tracks = [];
    for (const track of lesson.tracks) {
      const audio = await supabase.storage
        .from("study-files")
        .createSignedUrl(track.storagePath!, 60 * 60 * 24);
      check(audio.error);
      tracks.push({ ...track, url: audio.data!.signedUrl });
    }
    lessons.push({
      ...lesson,
      pdfUrl: pdf.data!.signedUrl,
      tracks,
      cloud: true,
      ownerId: row.user_id,
    });
  }
  return lessons;
}

/** Save page links for an existing cloud lesson without reuploading its audio. */
export async function updateCloudLinks(lesson: Lesson) {
  if (!supabase || !lesson.cloud) return;
  const metadata = {
    ...lesson,
    pdf: undefined,
    pdfUrl: undefined,
    tracks: lesson.tracks.map(({ blob: _blob, url: _url, ...track }) => track),
  };
  const { error } = await supabase
    .from("lessons")
    .update({ metadata })
    .eq("id", lesson.id);
  check(error);
}
