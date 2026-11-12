export interface Track {
  id: string;
  name: string;
  track: string | null;
  pages: number[];
  blob?: Blob;
  url?: string;
  storagePath?: string;
}
export interface Lesson {
  id: string;
  title: string;
  category: "Listening" | "Speaking";
  createdAt: string;
  pdf?: Blob;
  pdfUrl?: string;
  pdfPath?: string;
  tracks: Track[];
  demo?: boolean;
  cloud?: boolean;
  ownerId?: string;
}
export interface Progress {
  page: number;
  notes: string;
  completed: boolean;
  answers: Record<string, string>;
}
