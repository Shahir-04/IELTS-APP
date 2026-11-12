import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudUpload,
  FileAudio,
  FileText,
  Headphones,
  HelpCircle,
  LayoutGrid,
  Leaf,
  Link2,
  LoaderCircle,
  Maximize2,
  Mic,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { Lesson, Progress, Track } from "./types";
import { filenameTrack, pageTracks } from "./matching.mjs";
import {
  loadLibrary,
  loadProgress,
  saveLibrary,
  saveProgress,
} from "./storage";
import {
  loadCloudLibrary,
  supabase,
  updateCloudLinks,
  uploadLesson,
} from "./cloud";
import PdfReader from "./PdfReader";
import { CAMBRIDGE_ID, loadCambridgeLesson } from "./books/cambridge";

const demo: Lesson = {
  id: "lilt-original-1",
  title: "A little every day",
  category: "Listening",
  createdAt: "2026-01-01",
  pdfUrl: "/library/a-little-every-day.pdf",
  demo: true,
  tracks: [1, 2, 3].map((number) => ({
    id: `demo-${number}`,
    name: [
      "A place to call home",
      "The neighbourhood tour",
      "Somewhere you feel at home",
    ][number - 1],
    track: String(number),
    pages: [number],
    url: `/library/track-${String(number).padStart(2, "0")}.mp3`,
  })),
};

/** Keep object URLs alive only while the associated file is displayed. */
function useFileUrl(blob?: Blob, fallback?: string) {
  const [url, setUrl] = useState(fallback ?? "");
  useEffect(() => {
    if (!blob) {
      setUrl(fallback ?? "");
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob, fallback]);
  return url;
}
/** Format media and practice durations in minutes and seconds. */
function clock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}
/** Share consistent accessible icon controls throughout the workspace. */
function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
/** Trap keyboard focus inside dialogs and return it to the opening control. */
function Modal({
  title,
  subtitle,
  children,
  close,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const selector = "button:not([disabled]), input, select, textarea, a[href]";
    (panel.current?.querySelector(selector) as HTMLElement)?.focus();
    /** Keep Tab and Escape behavior predictable for keyboard users. */
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const items = [
        ...(panel.current?.querySelectorAll<HTMLElement>(selector) ?? []),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={close}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
/** Collect one PDF and its original audio files as a persistent study lesson. */
function UploadDialog({
  close,
  add,
}: {
  close: () => void;
  add: (lesson: Lesson) => Promise<void>;
}) {
  const [pdf, setPdf] = useState<File | null>(null),
    [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState(""),
    [category, setCategory] = useState<"Listening" | "Speaking">("Listening");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  /** Validate before committing any files to the local library. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!pdf || !title.trim()) {
      setError("Choose a PDF and give your lesson a name.");
      return;
    }
    if (!pdf.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF document.");
      return;
    }
    if (
      pdf.size + files.reduce((sum, file) => sum + file.size, 0) >
      250 * 1024 * 1024
    ) {
      setError(
        "Please keep each lesson below 250 MB. You can split a large book into smaller lessons.",
      );
      return;
    }
    setBusy(true);
    try {
      await add({
        id: crypto.randomUUID(),
        title: title.trim(),
        category,
        createdAt: new Date().toISOString(),
        pdf,
        tracks: files.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          blob: file,
          track: filenameTrack(file.name),
          pages: [],
        })),
      });
      close();
    } catch {
      setError(
        "Your browser could not save these files. Free some storage or try a smaller lesson.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Make room for a little progress."
      subtitle="Bring your PDF and audio together in one study space."
      close={close}
    >
      <form onSubmit={submit} className="upload-form">
        <label>
          Lesson name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Cambridge IELTS · Test 1"
            required
          />
        </label>
        <div className="category-choice">
          {(["Listening", "Speaking"] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={category === value ? "chosen" : ""}
              onClick={() => setCategory(value)}
            >
              {value === "Listening" ? (
                <Headphones size={17} />
              ) : (
                <Mic size={17} />
              )}
              {value}
            </button>
          ))}
        </div>
        <label className="file-drop">
          <span className="upload-icon">
            <FileText size={25} />
          </span>
          <strong>{pdf ? pdf.name : "Choose your study PDF"}</strong>
          <span>One PDF document</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            aria-label="Choose PDF"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setPdf(file);
                if (!title) setTitle(file.name.replace(/\.pdf$/i, ""));
              }
            }}
            required
          />
        </label>
        <label className="audio-drop">
          <FileAudio size={22} />
          <div>
            <strong>
              {files.length
                ? `${files.length} audio file${files.length === 1 ? "" : "s"} selected`
                : "Add the accompanying audio"}
            </strong>
            <span>MP3, M4A, WAV, OGG · select multiple files</span>
          </div>
          <Plus size={20} />
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"
            multiple
            aria-label="Choose audio files"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>
        <p className="small-note">
          <Sparkles size={15} /> Files named “Track 01” are matched to
          references in your PDF. You can also link them manually.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full" type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <Plus size={18} />
          )}
          {busy ? "Saving your lesson…" : "Add to my library"}
        </button>
        <p className="privacy-note">
          Saved on this device. Use Cloud library to sync privately.
        </p>
      </form>
    </Modal>
  );
}
/** Record short speaking practice locally, releasing the microphone on stop or exit. */
function SpeakingRecorder() {
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const [recording, setRecording] = useState(false),
    [blob, setBlob] = useState<Blob>(),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  const url = useFileUrl(blob);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  /** Ask for microphone permission only when practice recording begins. */
  async function start() {
    setError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Recording requires a supported browser on HTTPS or localhost.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission can resolve after the user has already left this panel.
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const instance = new MediaRecorder(media);
      recorder.current = instance;
      const chunks: Blob[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onstop = () => {
        if (mounted.current) {
          setBlob(new Blob(chunks, { type: instance.mimeType }));
          setRecording(false);
        }
        media.getTracks().forEach((track) => track.stop());
      };
      instance.start();
      setBlob(undefined);
      setSeconds(0);
      setRecording(true);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError(
        "Microphone access was unavailable. Allow microphone access in your browser and try again.",
      );
    }
  }
  return (
    <div className="recorder">
      <div className={`recorder-orb ${recording ? "recording" : ""}`}>
        <Mic size={29} />
      </div>
      <h3>
        {recording ? "You have the floor." : "Find your speaking rhythm."}
      </h3>
      <p>
        Take a moment to prepare, then record your answer. Listen back and
        notice one thing to improve.
      </p>
      <div className="recording-clock">
        {clock(seconds)} <span>/ aim for 2:00</span>
      </div>
      <button
        className={recording ? "danger full" : "primary full"}
        onClick={() => (recording ? recorder.current?.stop() : void start())}
      >
        {recording ? <Square size={15} /> : <Mic size={17} />}
        {recording ? "Finish recording" : "Start recording"}
      </button>
      {url && (
        <div className="recording-result">
          <audio controls src={url} />
          <a
            className="text-link"
            href={url}
            download={`lilt-speaking.${blob?.type.includes("mp4") ? "m4a" : blob?.type.includes("ogg") ? "ogg" : "webm"}`}
          >
            <ArrowDownToLine size={15} />
            Save recording
          </a>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="privacy-note">
        Your recording stays on this device. Download it to keep it.
      </p>
    </div>
  );
}

/** Keep PDF, matched tracks, notes and playback together for a single lesson. */
function StudyRoom({
  lesson,
  update,
  notify,
  bookmarked,
  toggleBookmark,
}: {
  lesson: Lesson;
  update: (lesson: Lesson) => Promise<void>;
  notify: (message: string) => void;
  bookmarked: string[];
  toggleBookmark: (key: string) => void;
}) {
  const [progress, setProgress] = useState<Progress>(() =>
    loadProgress(lesson.id, lesson.startPage),
  );
  const [pageCount, setPageCount] = useState(0),
    [pageText, setPageText] = useState(""),
    [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState("Audio"),
    [allTracks, setAllTracks] = useState(false),
    [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [trackQuery, setTrackQuery] = useState("");
  const [playing, setPlaying] = useState(false),
    [currentTime, setCurrentTime] = useState(0),
    [duration, setDuration] = useState(0),
    [speed, setSpeed] = useState(1),
    [repeat, setRepeat] = useState(false),
    [volume, setVolume] = useState(0.8);
  const [linking, setLinking] = useState(false);
  const audio = useRef<HTMLAudioElement>(null),
    documentPanel = useRef<HTMLDivElement>(null);
  const source = useFileUrl(lesson.pdf, lesson.pdfUrl),
    audioSource = useFileUrl(activeTrack?.blob, activeTrack?.url);
  const matches: Track[] = pageTracks(lesson.tracks, pageText, progress.page);
  const shownTracks = (allTracks ? lesson.tracks : matches).filter(
    (track) =>
      !allTracks ||
      `${track.name} ${track.track}`
        .toLowerCase()
        .includes(trackQuery.toLowerCase()),
  );
  const bookmarkKey = `${lesson.id}:${progress.page}`;
  const onPdfLoad = useCallback((count: number) => {
    setPageCount(count);
    setProgress((value) => ({ ...value, page: Math.min(value.page, count) }));
  }, []);
  const onPdfText = useCallback((text: string) => setPageText(text), []);
  useEffect(() => {
    try {
      saveProgress(lesson.id, progress);
    } catch {
      notify(
        "Your browser could not save the latest notes. Copy them before leaving.",
      );
    }
  }, [lesson.id, progress, notify]);
  useEffect(() => {
    if (audio.current) {
      audio.current.playbackRate = speed;
      audio.current.volume = volume;
    }
  }, [speed, volume, audioSource]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const value = Number(localStorage.getItem("lilt-practice-seconds") ?? 0);
      localStorage.setItem("lilt-practice-seconds", String(value + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [playing]);
  /** Wait for the new audio URL before starting a newly selected track. */
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    if (audioSource && audio.current) audio.current.load();
  }, [audioSource]);
  /** Switch reading pages without automatically interrupting the current audio. */
  function changePage(page: number) {
    setPageText("");
    setProgress((value) => ({
      ...value,
      page: Math.max(1, Math.min(pageCount || 1, page)),
    }));
  }
  /** Play a selected track, or toggle the track that is already loaded. */
  function selectTrack(track: Track) {
    if (activeTrack?.id === track.id) {
      togglePlayback();
      return;
    }
    setActiveTrack(track);
  }
  /** Catch browser playback errors and show an actionable message. */
  function play() {
    void audio.current
      ?.play()
      .catch(() =>
        notify(
          "Could not play this audio. Check the file format or refresh your cloud library.",
        ),
      );
  }
  /** Pause or resume playback in response to an explicit user control. */
  function togglePlayback() {
    if (!activeTrack) {
      if (matches[0] || lesson.tracks[0])
        setActiveTrack(matches[0] ?? lesson.tracks[0]);
      return;
    }
    if (audio.current?.paused) play();
    else audio.current?.pause();
  }
  /** Clamp seeking so buttons work close to the beginning and end of a track. */
  function seek(value: number) {
    if (audio.current && Number.isFinite(duration))
      audio.current.currentTime = Math.min(duration, Math.max(0, value));
  }
  /** Save or remove a manual track association for this specific PDF page. */
  async function linkTrack(track: Track) {
    const pages = track.pages.includes(progress.page)
      ? track.pages.filter((page) => page !== progress.page)
      : [...track.pages, progress.page];
    try {
      await update({
        ...lesson,
        tracks: lesson.tracks.map((item) =>
          item.id === track.id ? { ...item, pages } : item,
        ),
      });
    } catch {
      notify("The page link could not be saved. Please try again.");
    }
  }
  /** Ask the browser for fullscreen only after the reader control is clicked. */
  function fullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void documentPanel.current
        ?.requestFullscreen?.()
        .catch(() => notify("Fullscreen is not available in this browser."));
  }
  return (
    <>
      <div className="workspace-heading">
        <div className="breadcrumbs">
          MY STUDY SPACE <span>/</span> {lesson.category.toUpperCase()}
        </div>
        <div className="workspace-title">
          <div>
            <h1>
              A little practice. <em>A lot of possibility.</em>
            </h1>
            <p>Your pages, your audio, your pace. Let’s make progress.</p>
          </div>
          <div className="session-badge">
            <span className="live-dot" />
            You’re in your study space
          </div>
        </div>
      </div>
      <div className="lesson-heading">
        <div className="lesson-symbol">
          <BookOpen size={23} />
        </div>
        <div>
          <h2>{lesson.title}</h2>
          <p>
            {lesson.publisher ??
              (lesson.demo
                ? "Lilt original practice"
                : lesson.category + " practice")}
            <span>•</span>
            {pageCount || "—"} pages<span>•</span>
            {lesson.tracks.length} audio tracks
          </p>
        </div>
        <div className="lesson-actions">
          <span className="pill">{lesson.category}</span>
          <IconButton
            label={
              progress.completed
                ? "Mark as in progress"
                : "Mark lesson complete"
            }
            active={progress.completed}
            onClick={() => {
              setProgress((value) => ({
                ...value,
                completed: !value.completed,
              }));
              notify(
                progress.completed
                  ? "Lesson marked as in progress."
                  : "Another little step forward. Lesson complete!",
              );
            }}
          >
            <CheckCircle2 size={20} />
          </IconButton>
        </div>
      </div>
      <div className="study-layout">
        <section className="document-panel" ref={documentPanel}>
          <div className="reader-toolbar">
            <div className="page-controls">
              <IconButton
                label="Previous page"
                onClick={() => changePage(progress.page - 1)}
                disabled={progress.page <= 1}
              >
                <ChevronLeft size={18} />
              </IconButton>
              <span>
                Page{" "}
                <select
                  aria-label="PDF page"
                  value={progress.page}
                  onChange={(event) => changePage(Number(event.target.value))}
                >
                  {Array.from({ length: pageCount || 1 }, (_, index) => (
                    <option key={index + 1}>{index + 1}</option>
                  ))}
                </select>
                <span className="muted">of {pageCount || "—"}</span>
              </span>
              <IconButton
                label="Next page"
                onClick={() => changePage(progress.page + 1)}
                disabled={progress.page >= pageCount}
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
            <div className="reader-tools">
              <IconButton
                label="Zoom out"
                onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
                disabled={zoom <= 0.6}
              >
                <Minus size={15} />
              </IconButton>
              <span>{Math.round(zoom * 100)}%</span>
              <IconButton
                label="Zoom in"
                onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}
                disabled={zoom >= 1.8}
              >
                <Plus size={15} />
              </IconButton>
              <span className="toolbar-divider" />
              <IconButton
                label="Bookmark this page"
                active={bookmarked.includes(bookmarkKey)}
                onClick={() => toggleBookmark(bookmarkKey)}
              >
                <Bookmark
                  size={17}
                  fill={
                    bookmarked.includes(bookmarkKey) ? "currentColor" : "none"
                  }
                />
              </IconButton>
              <IconButton label="Toggle fullscreen" onClick={fullscreen}>
                <Maximize2 size={16} />
              </IconButton>
            </div>
          </div>
          {source && (
            <PdfReader
              source={source}
              page={progress.page}
              zoom={zoom}
              onLoad={onPdfLoad}
              onText={onPdfText}
            />
          )}
          <div className="reader-footer">
            <Leaf size={14} />
            <span>A little focus goes a long way.</span>
            <span className="page-number">
              {String(progress.page).padStart(2, "0")} /{" "}
              {String(pageCount).padStart(2, "0")}
            </span>
          </div>
        </section>
        <aside className="practice-panel">
          <div className="practice-tabs">
            {[
              { name: "Audio", icon: Headphones },
              { name: "Notes", icon: FileText },
              { name: "Speak", icon: Mic },
            ].map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={tab === name ? "selected" : ""}
                onClick={() => setTab(name)}
              >
                <Icon size={16} />
                {name}
              </button>
            ))}
          </div>
          {tab === "Audio" ? (
            <>
              <div className="panel-title">
                <div>
                  <h3>Your listening companion</h3>
                  <p>A good listen is a step forward.</p>
                </div>
                <span className="tiny-icon">
                  <AudioLines size={20} />
                </span>
              </div>
              <div className="track-scope">
                <button
                  className={!allTracks ? "selected" : ""}
                  onClick={() => setAllTracks(false)}
                >
                  This page <span>{matches.length}</span>
                </button>
                <button
                  className={allTracks ? "selected" : ""}
                  onClick={() => setAllTracks(true)}
                >
                  All tracks <span>{lesson.tracks.length}</span>
                </button>
              </div>
              {allTracks && lesson.tracks.length > 8 && (
                <label className="track-search">
                  <Search size={14} />
                  <input
                    aria-label="Search audio tracks"
                    placeholder="Find a track, test, or section…"
                    value={trackQuery}
                    onChange={(event) => setTrackQuery(event.target.value)}
                  />
                </label>
              )}
              <div className="match-status">
                <span className="live-dot" />
                {allTracks
                  ? "All audio in this lesson"
                  : matches.length
                    ? `Matched to page ${progress.page}`
                    : "No audio linked to this page"}
              </div>
              <div className="track-list">
                {shownTracks.map((track, index) => (
                  <div
                    className={`track-card ${activeTrack?.id === track.id ? "current" : ""}`}
                    key={track.id}
                  >
                    <div className="track-top">
                      <span className="track-number">
                        TRACK{" "}
                        {track.track?.padStart(2, "0") ??
                          String(index + 1).padStart(2, "0")}
                      </span>
                      {activeTrack?.id === track.id && playing ? (
                        <span className="now-playing">
                          Playing <span className="mini-wave">ıııı</span>
                        </span>
                      ) : (
                        <Headphones size={14} />
                      )}
                    </div>
                    <h4>{track.name.replace(/\.(mp3|wav|m4a|ogg)$/i, "")}</h4>
                    <p>
                      {track.pages.length
                        ? `Page ${track.pages.join(", ")}`
                        : "Detected from PDF reference"}
                      <span>•</span>
                      {lesson.bundled
                        ? "Book audio"
                        : lesson.demo
                          ? "Original practice"
                          : "Your audio"}
                    </p>
                    <div className="track-bottom">
                      <button
                        className="track-play"
                        onClick={() => selectTrack(track)}
                        aria-label={`${activeTrack?.id === track.id && playing ? "Pause" : "Play"} ${track.name}`}
                      >
                        {activeTrack?.id === track.id && playing ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play size={14} fill="currentColor" />
                        )}
                        {activeTrack?.id === track.id && playing
                          ? "Pause audio"
                          : "Play audio"}
                      </button>
                      <span className="audio-dots">▂ ▅ ▃ ▇ ▄ ▂ ▅ ▃ ▆ ▂ ▄</span>
                    </div>
                    {allTracks && track.pages.length > 0 && (
                      <button
                        className="track-page-link"
                        onClick={() => {
                          changePage(track.pages[0]);
                          setAllTracks(false);
                          documentPanel.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                      >
                        Open page {track.pages[0]}
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!shownTracks.length && (
                  <div className="empty-tracks">
                    <Headphones size={28} />
                    <h4>Your audio belongs here.</h4>
                    <p>
                      {lesson.tracks.length
                        ? "Link a track to this page below, or browse all tracks. Scanned pages need manual linking."
                        : "Add audio files with a new lesson to listen as you read."}
                    </p>
                    {lesson.tracks.length > 0 && (
                      <button
                        className="text-link"
                        onClick={() => setAllTracks(true)}
                      >
                        Browse all tracks <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                className="link-audio"
                onClick={() => setLinking((value) => !value)}
                disabled={!lesson.tracks.length}
              >
                <Link2 size={15} />
                Link audio to this page
                <Plus size={15} />
              </button>
              {linking && (
                <div className="link-options">
                  <p>Select tracks for page {progress.page}</p>
                  {lesson.tracks.map((track) => (
                    <label key={track.id}>
                      <input
                        type="checkbox"
                        checked={track.pages.includes(progress.page)}
                        onChange={() => void linkTrack(track)}
                      />
                      {track.name}
                    </label>
                  ))}
                </div>
              )}
              <div className="study-tip">
                <div className="tip-heading">
                  <Sparkles size={16} />
                  <span>A LITTLE STUDY TIP</span>
                </div>
                <p>
                  Listen once to understand.
                  <br />
                  Listen again to notice.
                  <br />
                  <strong>Progress is in the little things.</strong>
                </p>
                <div className="tip-art">
                  <span />
                  <span />
                  <span />
                  <Leaf size={47} strokeWidth={1} />
                </div>
              </div>
              <div className="panel-footer">
                <span className="live-dot" />
                {lesson.bundled
                  ? "Included in your library on every device"
                  : lesson.cloud
                    ? "Available in your cloud library"
                    : "Your study space, saved on this device"}
              </div>
            </>
          ) : tab === "Notes" ? (
            <div className="notes-panel">
              <h3>Make it stick.</h3>
              <p>Keep answers, new words, and little discoveries here.</p>
              {lesson.demo && progress.page === 1 && (
                <div className="answer-fields">
                  <h4>Your answers · Questions 1–5</h4>
                  {[1, 2, 3, 4, 5].map((number) => (
                    <label key={number}>
                      {number}
                      <input
                        placeholder="Your answer"
                        value={progress.answers[number] ?? ""}
                        onChange={(event) =>
                          setProgress((value) => ({
                            ...value,
                            answers: {
                              ...value.answers,
                              [number]: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="text-link"
                    onClick={() =>
                      notify(
                        "Answers: 1 twelve / 12 · 2 single · 3 180 · 4 railway · 5 Monday",
                      )
                    }
                  >
                    Check sample answers <Check size={15} />
                  </button>
                </div>
              )}
              <label className="notes-label" htmlFor="lesson-notes">
                Your lesson notes
              </label>
              <textarea
                id="lesson-notes"
                placeholder="A new word. A useful phrase. Something to remember…"
                value={progress.notes}
                onChange={(event) =>
                  setProgress((value) => ({
                    ...value,
                    notes: event.target.value,
                  }))
                }
              />
              <span className="saved-note">
                <Check size={13} />
                Saved on this device
              </span>
            </div>
          ) : (
            <SpeakingRecorder />
          )}
        </aside>
      </div>
      <div className="below-reader">
        <span>
          <Headphones size={15} />
          Made for focused minds and fresh starts.
        </span>
        <span>One page at a time.</span>
      </div>
      <footer className="player">
        <div className="player-track">
          <div className={`player-art ${playing ? "is-playing" : ""}`}>
            <AudioLines size={23} />
          </div>
          <div>
            <span className="eyebrow">
              {activeTrack
                ? `TRACK ${activeTrack.track?.padStart(2, "0") ?? "—"}`
                : "READY WHEN YOU ARE"}
            </span>
            <strong>
              {activeTrack?.name.replace(/\.(mp3|wav|m4a|ogg)$/i, "") ??
                "A little listening goes a long way"}
            </strong>
            <small>{lesson.title}</small>
          </div>
        </div>
        <div className="player-center">
          <div className="transport">
            <IconButton
              label="Back 10 seconds"
              onClick={() => seek(currentTime - 10)}
              disabled={!activeTrack}
            >
              <RotateCcw size={19} />
              <small>10</small>
            </IconButton>
            <button
              className="main-play"
              aria-label={playing ? "Pause audio" : "Play audio"}
              onClick={togglePlayback}
              disabled={!lesson.tracks.length}
            >
              {playing ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <IconButton
              label="Forward 10 seconds"
              onClick={() => seek(currentTime + 10)}
              disabled={!activeTrack}
            >
              <RotateCw size={19} />
              <small>10</small>
            </IconButton>
          </div>
          <div className="timeline">
            <span>{clock(currentTime)}</span>
            <input
              type="range"
              aria-label="Audio position"
              min="0"
              max={duration || 1}
              step="0.1"
              value={Math.min(currentTime, duration || 1)}
              disabled={!duration}
              onChange={(event) => seek(Number(event.target.value))}
              style={
                {
                  "--fill": `${duration ? (currentTime / duration) * 100 : 0}%`,
                } as React.CSSProperties
              }
            />
            <span>{clock(duration)}</span>
          </div>
        </div>
        <div className="player-options">
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
              <option value={value} key={value}>
                {value}×
              </option>
            ))}
          </select>
          <IconButton
            label="Repeat track"
            active={repeat}
            onClick={() => setRepeat((value) => !value)}
          >
            <Repeat2 size={18} />
          </IconButton>
          <Volume2 size={17} />
          <input
            type="range"
            aria-label="Volume"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
        <audio
          ref={audio}
          src={audioSource || undefined}
          loop={repeat}
          onCanPlay={() => {
            if (activeTrack && audio.current?.currentTime === 0) play();
          }}
          onLoadedMetadata={() => setDuration(audio.current?.duration ?? 0)}
          onDurationChange={() => setDuration(audio.current?.duration ?? 0)}
          onTimeUpdate={() => setCurrentTime(audio.current?.currentTime ?? 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            if (audioSource)
              notify(
                "This audio could not be loaded. Try another file or refresh your cloud library.",
              );
          }}
        />
      </footer>
    </>
  );
}

/** Own the library, navigation, account connection and persistent workspace shell. */
export default function App() {
  const [lessons, setLessons] = useState<Lesson[]>(() => [
      loadCambridgeLesson(),
      demo,
    ]),
    [activeId, setActiveId] = useState(
      () =>
        new URLSearchParams(window.location.search).get("lesson") ??
        localStorage.getItem("lilt-active-lesson") ??
        CAMBRIDGE_ID,
    ),
    [view, setView] = useState("Study room");
  const [modal, setModal] = useState<"upload" | "cloud" | "help" | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All lessons");
  const [toast, setToast] = useState(""),
    [email, setEmail] = useState(""),
    [userEmail, setUserEmail] = useState(""),
    [cloudBusy, setCloudBusy] = useState(false),
    [cloudMessage, setCloudMessage] = useState("");
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lilt-bookmarks") ?? "[]");
    } catch {
      return [];
    }
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lessonsRef = useRef(lessons);
  lessonsRef.current = lessons;
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6500);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  useEffect(() => {
    localStorage.setItem("lilt-active-lesson", activeId);
  }, [activeId]);
  useEffect(() => {
    let disposed = false;
    void loadLibrary()
      .then(async (items) => {
        const session = supabase
          ? (await supabase.auth.getSession()).data.session
          : null;
        const visible = items.filter(
          (lesson) => !lesson.cloud || lesson.ownerId === session?.user.id,
        );
        if (!disposed)
          setLessons([
            loadCambridgeLesson(),
            demo,
            ...visible.filter((lesson) => !lesson.bundled),
          ]);
      })
      .catch(() =>
        notify(
          "Browser storage is unavailable. Imported files may not persist.",
        ),
      );
    return () => {
      disposed = true;
      clearTimeout(toastTimer.current);
    };
  }, [notify]);
  /** Merge signed cloud links with local original files to preserve offline access. */
  async function refreshCloud() {
    if (!supabase) return;
    const accountId = (await supabase.auth.getSession()).data.session?.user.id;
    if (!accountId) return;
    const remote = await loadCloudLibrary();
    // Ignore an in-flight refresh if the user signed out or switched accounts.
    if ((await supabase.auth.getSession()).data.session?.user.id !== accountId)
      return;
    const local = lessonsRef.current;
    const ids = new Set(remote.map((lesson) => lesson.id));
    const merged = [
      ...local.filter((lesson) => !lesson.cloud && !ids.has(lesson.id)),
      ...remote.map((lesson) => {
        const existing = local.find((item) => item.id === lesson.id);
        return {
          ...lesson,
          pdf: existing?.pdf,
          tracks: lesson.tracks.map((track) => ({
            ...track,
            blob: existing?.tracks.find((item) => item.id === track.id)?.blob,
          })),
        };
      }),
    ];
    await saveLibrary(merged);
    setLessons(merged);
  }
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? "");
      // Defer database work until Supabase has finished its auth callback.
      if (session)
        setTimeout(() => {
          void refreshCloud().catch((error) =>
            notify(`Cloud library: ${error.message}`),
          );
        }, 0);
    });
    return () => subscription.unsubscribe();
  }, [notify]);
  /** Reflect page links immediately, restoring the previous lesson if persistence fails. */
  async function update(lesson: Lesson) {
    const previous = lessonsRef.current;
    const next = previous.map((item) =>
      item.id === lesson.id ? lesson : item,
    );
    lessonsRef.current = next;
    setLessons(next);
    try {
      if (lesson.bundled)
        localStorage.setItem(
          `lilt-bundled-links-${lesson.id}`,
          JSON.stringify(
            Object.fromEntries(
              lesson.tracks.map((track) => [track.id, track.pages]),
            ),
          ),
        );
      await updateCloudLinks(lesson);
      await saveLibrary(next);
    } catch (error) {
      lessonsRef.current = previous;
      setLessons(previous);
      throw error;
    }
  }
  /** Commit uploads locally and open the new lesson immediately. */
  async function add(lesson: Lesson) {
    const next = [...lessonsRef.current, lesson];
    await saveLibrary(next);
    setLessons(next);
    setActiveId(lesson.id);
    setView("Study room");
    notify("Your lesson is ready. Let’s make a little progress.");
  }
  /** Save page bookmarks using lesson-scoped keys. */
  function toggleBookmark(key: string) {
    const next = bookmarks.includes(key)
      ? bookmarks.filter((value) => value !== key)
      : [...bookmarks, key];
    try {
      localStorage.setItem("lilt-bookmarks", JSON.stringify(next));
      setBookmarks(next);
    } catch {
      notify("Your browser could not save this bookmark.");
    }
  }
  /** Send a passwordless email link when a cloud backend has been configured. */
  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setCloudBusy(true);
    setCloudMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setCloudMessage("Check your email for your private sign-in link.");
    } catch (error) {
      setCloudMessage(
        error instanceof Error
          ? error.message
          : "Could not send a sign-in link. Try again.",
      );
    } finally {
      setCloudBusy(false);
    }
  }
  /** Sync local originals, then refresh signed cloud links for this account. */
  async function sync() {
    setCloudBusy(true);
    setCloudMessage("");
    try {
      for (const lesson of lessonsRef.current.filter(
        (item) => !item.demo && !item.cloud && item.pdf,
      )) {
        const synced = await uploadLesson(lesson);
        const next = lessonsRef.current.map((item) =>
          item.id === lesson.id ? synced : item,
        );
        await saveLibrary(next);
        lessonsRef.current = next;
        setLessons(next);
      }
      await refreshCloud();
      setCloudMessage(
        "Your library is up to date. Sign in on another device to keep learning.",
      );
    } catch (error) {
      setCloudMessage(
        error instanceof Error
          ? error.message
          : "Sync failed. Your local files are safe.",
      );
    } finally {
      setCloudBusy(false);
    }
  }
  /** Remove cached private lessons when signing out of the cloud account. */
  async function signOut() {
    if (!supabase) return;
    setCloudBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      const local = lessonsRef.current.filter((lesson) => !lesson.cloud);
      await saveLibrary(local);
      setLessons(local);
      setActiveId(demo.id);
      setCloudMessage(
        "Signed out. Your cloud lessons are safely stored in your account and removed from this device.",
      );
    } catch (error) {
      setCloudMessage(
        error instanceof Error
          ? error.message
          : "Could not finish signing out. Please try again.",
      );
    } finally {
      setCloudBusy(false);
    }
  }
  /** Remove only device-local lessons; cloud deletion is deliberately explicit in setup docs. */
  async function remove(lesson: Lesson) {
    const next = lessonsRef.current.filter((item) => item.id !== lesson.id);
    try {
      await saveLibrary(next);
      setLessons(next);
      if (activeId === lesson.id) setActiveId(CAMBRIDGE_ID);
      notify("Lesson removed from this device.");
    } catch {
      notify("Could not remove this lesson. Please try again.");
    }
  }
  const active = lessons.find((lesson) => lesson.id === activeId) ?? demo;
  const filtered = lessons.filter(
    (lesson) =>
      lesson.title.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All lessons" || lesson.category === filter) &&
      (view !== "Bookmarks" ||
        bookmarks.some((key) => key.startsWith(`${lesson.id}:`))),
  );
  const minutes = Math.floor(
    Number(localStorage.getItem("lilt-practice-seconds") ?? 0) / 60,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            setView("Study room");
          }}
        >
          <span className="brand-icon">
            <AudioLines size={27} />
          </span>
          lilt<span className="brand-dot">.</span>
        </a>
        <span className="brand-subtitle">A LITTLE ENGLISH, EVERY DAY.</span>
        <div className="sidebar-section-label">YOUR SPACE</div>
        <nav>
          {[
            { name: "Study room", icon: BookOpen },
            { name: "My library", icon: LayoutGrid },
            { name: "Bookmarks", icon: Bookmark },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "nav-active" : ""}
              onClick={() => setView(name)}
            >
              <Icon size={19} />
              {name}
              {name === "My library" && (
                <span className="nav-count">{lessons.length}</span>
              )}
              {name === "Study room" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-section-label recent-heading">
          ON YOUR SHELF{" "}
          <span>{lessons.length.toString().padStart(2, "0")}</span>
        </div>
        <div className="shelf-list">
          {lessons
            .slice(-4)
            .reverse()
            .map((lesson) => (
              <button
                className={activeId === lesson.id ? "shelf-active" : ""}
                key={lesson.id}
                onClick={() => {
                  setActiveId(lesson.id);
                  setView("Study room");
                }}
              >
                <span
                  className={`book-spine ${lesson.category === "Speaking" ? "peach" : ""}`}
                >
                  <BookOpen size={16} />
                </span>
                <span>
                  <strong>{lesson.title}</strong>
                  <small>
                    {lesson.demo
                      ? "Your first little lesson"
                      : lesson.category + " practice"}
                  </small>
                </span>
              </button>
            ))}
          <button className="shelf-add" onClick={() => setModal("upload")}>
            <Plus size={16} />
            Add study material
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="growth-card">
            <span className="growth-spark">✳</span>
            <h4>
              A little better,
              <br />
              every day.
            </h4>
            <p>
              You don’t have to be perfect.
              <br />
              You just have to keep going.
            </p>
            <div className="growth-line">
              <span
                style={{ width: `${Math.min((minutes / 15) * 100, 100)}%` }}
              />
            </div>
            <small>{minutes} / 15 minutes of listening</small>
          </div>
          <button className="sidebar-help" onClick={() => setModal("help")}>
            <HelpCircle size={17} />A little help
            <ArrowRight size={15} />
          </button>
          <div className="profile">
            <span className="avatar">
              {userEmail ? userEmail[0].toUpperCase() : "Y"}
            </span>
            <div>
              <strong>
                {userEmail ? userEmail.split("@")[0] : "Your learning journey"}
              </strong>
              <small>One step closer.</small>
            </div>
            <button
              aria-label="Cloud library settings"
              onClick={() => setModal("cloud")}
            >
              <Settings2 size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-greeting">
            <span className="sun-icon">✳</span>A fresh page. A fresh start.
          </div>
          <div className="topbar-actions">
            <button className="cloud-button" onClick={() => setModal("cloud")}>
              <Cloud size={17} />
              <span>Cloud library</span>
              {userEmail && <span className="live-dot" />}
            </button>
            <span className="header-divider" />
            <button
              className="primary small"
              onClick={() => setModal("upload")}
            >
              <Plus size={16} />
              Add material
            </button>
            <span className="top-avatar">
              {userEmail ? userEmail[0].toUpperCase() : "Y"}
            </span>
          </div>
        </header>
        <main>
          {view === "Study room" ? (
            <StudyRoom
              key={active.id}
              lesson={active}
              update={update}
              notify={notify}
              bookmarked={bookmarks}
              toggleBookmark={toggleBookmark}
            />
          ) : (
            <div className="library-view">
              <div className="breadcrumbs">
                MY STUDY SPACE <span>/</span>
                {view.toUpperCase()}
              </div>
              <div className="library-heading">
                <div>
                  <h1>
                    {view === "Bookmarks"
                      ? "Good pages to come back to."
                      : "Your next little step starts here."}
                  </h1>
                  <p>
                    {view === "Bookmarks"
                      ? "All the lessons with pages you’ve saved."
                      : "A growing collection for your growing confidence."}
                  </p>
                </div>
                <button className="primary" onClick={() => setModal("upload")}>
                  <Plus size={17} />
                  Add material
                </button>
              </div>
              <div className="library-controls">
                <div className="library-filters">
                  {["All lessons", "Listening", "Speaking"].map((value) => (
                    <button
                      key={value}
                      className={filter === value ? "selected" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search lessons"
                    placeholder="Find a lesson…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>
              <div className="library-grid">
                {filtered.map((lesson) => (
                  <article className="lesson-card" key={lesson.id}>
                    <div
                      className={`book-cover ${lesson.category === "Speaking" ? "peach" : ""}`}
                    >
                      <div className="cover-label">
                        LILT / YOUR STUDY COLLECTION
                      </div>
                      <BookOpen size={39} strokeWidth={1.2} />
                      <h3>{lesson.title}</h3>
                      <span>
                        {lesson.category.toUpperCase()}
                        <span>✳</span>
                      </span>
                    </div>
                    <div className="lesson-card-body">
                      <span className="eyebrow">
                        {lesson.bundled
                          ? "INCLUDED BOOK & AUDIO"
                          : lesson.demo
                            ? "ORIGINAL PRACTICE"
                            : lesson.cloud
                              ? "CLOUD LIBRARY"
                              : "SAVED ON THIS DEVICE"}
                      </span>
                      <h3>{lesson.title}</h3>
                      <p>
                        {lesson.tracks.length} audio tracks · {lesson.category}
                      </p>
                      {view === "Bookmarks" && (
                        <div className="bookmark-pages">
                          {bookmarks
                            .filter((key) => key.startsWith(`${lesson.id}:`))
                            .map((key) => {
                              const page = Number(key.split(":").pop());
                              return (
                                <button
                                  key={key}
                                  onClick={() => {
                                    saveProgress(lesson.id, {
                                      ...loadProgress(lesson.id),
                                      page,
                                    });
                                    setActiveId(lesson.id);
                                    setView("Study room");
                                  }}
                                >
                                  <Bookmark size={12} />
                                  Page {page}
                                </button>
                              );
                            })}
                        </div>
                      )}
                      <div className="lesson-card-bottom">
                        <button
                          className="text-link"
                          onClick={() => {
                            setActiveId(lesson.id);
                            setView("Study room");
                          }}
                        >
                          Open lesson
                          <ArrowRight size={16} />
                        </button>
                        {!lesson.demo && !lesson.bundled && !lesson.cloud && (
                          <IconButton
                            label={`Remove ${lesson.title} from this device`}
                            onClick={() => void remove(lesson)}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                        {loadProgress(lesson.id).completed && (
                          <CheckCircle2 size={18} />
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                <button
                  className="add-lesson-card"
                  onClick={() => setModal("upload")}
                >
                  <span>
                    <Plus size={24} />
                  </span>
                  <h3>A little room for more.</h3>
                  <p>
                    Add a PDF and its audio to
                    <br />
                    start your next lesson.
                  </p>
                  <strong>
                    Add study material
                    <ArrowRight size={15} />
                  </strong>
                </button>
              </div>
              {filtered.length === 0 && (
                <p className="empty-library">
                  {view === "Bookmarks"
                    ? "Bookmark a page in the study room to find its lesson here."
                    : "No lessons match your search yet."}
                </p>
              )}
            </div>
          )}
        </main>
      </div>
      {modal === "upload" && <UploadDialog close={closeModal} add={add} />}
      {modal === "help" && (
        <Modal
          title="A little help, a lot of progress."
          subtitle="Your PDF and audio, finally on the same page."
          close={closeModal}
        >
          <div className="help-content">
            {[
              {
                icon: FileText,
                title: "1. Bring your materials",
                text: "Add one study PDF and select all its accompanying audio files. Your originals are saved in this browser.",
              },
              {
                icon: Link2,
                title: "2. Find the right track",
                text: "We read track labels on each PDF page and match them to filenames such as Track 01.mp3 or CD1 Track02.mp3. For scanned pages, use “Link audio to this page”.",
              },
              {
                icon: Headphones,
                title: "3. Set your own pace",
                text: "Play alongside the page, slow down tricky phrases, skip back ten seconds, or repeat the whole track. Add notes and record your speaking.",
              },
              {
                icon: Cloud,
                title: "4. Take your library with you",
                text: "Cloud library keeps uploaded materials private and available across devices once Supabase is configured. Notes, bookmarks, listening time, and recordings stay on each device.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span className="help-icon">
                  <Icon size={21} />
                </span>
                <section>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </section>
              </div>
            ))}
            <div className="help-footnote">
              Original sample material is for practice and is not an official
              IELTS test. Sample audio uses a synthetic voice.
            </div>
          </div>
        </Modal>
      )}
      {modal === "cloud" && (
        <Modal
          title="Your little library, everywhere."
          subtitle="Private materials. Any device. The same you."
          close={closeModal}
        >
          <div className="cloud-content">
            <div className="cloud-illustration">
              <Cloud size={44} strokeWidth={1.2} />
              <BookOpen size={29} strokeWidth={1.2} />
            </div>
            {!supabase ? (
              <>
                <h3>One setup, then study anywhere.</h3>
                <p>
                  This app is ready for private cloud sync with Supabase. To
                  enable it, follow the setup in the project README and add the
                  two environment variables in Vercel.
                </p>
                <div className="setup-note">
                  <strong>
                    For now, your uploads are saved on this device.
                  </strong>
                  <span>
                    The sample lesson is available on every device. Notes and
                    recordings are always device-local.
                  </span>
                </div>
                <button className="primary full" onClick={closeModal}>
                  Back to my study space
                  <ArrowRight size={16} />
                </button>
              </>
            ) : userEmail ? (
              <>
                <h3>Welcome back, {userEmail.split("@")[0]}.</h3>
                <p>
                  Sync to upload local lessons and retrieve your private library
                  on this device. Files up to 50 MB each are supported by the
                  default cloud setup.
                </p>
                <button
                  className="primary full"
                  disabled={cloudBusy}
                  onClick={() => void sync()}
                >
                  {cloudBusy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <CloudUpload size={17} />
                  )}
                  {cloudBusy ? "Syncing your library…" : "Sync my library"}
                </button>
                <button
                  className="text-link centered"
                  disabled={cloudBusy}
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <form onSubmit={signIn}>
                <p>
                  Sign in with an email link to keep your PDFs and audio in a
                  private cloud library.
                </p>
                <label>
                  Email address
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <button className="primary full" disabled={cloudBusy}>
                  {cloudBusy ? "Sending…" : "Email me a sign-in link"}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
            {cloudMessage && (
              <p className="cloud-message" role="status">
                {cloudMessage}
              </p>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
