import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LoaderCircle, FileWarning } from "lucide-react";
GlobalWorkerOptions.workerSrc = workerUrl;
interface Props {
  source: string;
  page: number;
  zoom: number;
  onLoad: (count: number) => void;
  onText: (text: string) => void;
}
/** Render a PDF page at its visible width and extract text for track matching. */
export default function PdfReader({
  source,
  page,
  zoom,
  onLoad,
  onText,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(650);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    setDocument(null);
    // Fetch only the byte ranges needed for the current page of large books.
    const task = getDocument({
      url: source,
      disableAutoFetch: true,
      disableStream: true,
      rangeChunkSize: 256 * 1024,
    });
    task.promise
      .then((pdf) => {
        if (!disposed) {
          setDocument(pdf);
          onLoad(pdf.numPages);
        }
      })
      .catch((reason) => {
        if (!disposed) {
          setError(
            reason?.name === "PasswordException"
              ? "This PDF is password protected. Please upload an unlocked copy."
              : "We could not open this PDF. Please check the file and try again.",
          );
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      void task.destroy();
    };
  }, [source, onLoad]);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let disposed = false;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const pdfPage = await document.getPage(
          Math.min(page, document.numPages),
        );
        if (disposed || !canvas.current) return;
        const scale =
          (Math.max(200, width - 64) /
            pdfPage.getViewport({ scale: 1 }).width) *
          zoom;
        const viewport = pdfPage.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;
        canvas.current.width = viewport.width * ratio;
        canvas.current.height = viewport.height * ratio;
        canvas.current.style.width = `${viewport.width}px`;
        canvas.current.style.height = `${viewport.height}px`;
        render = pdfPage.render({
          canvas: canvas.current,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        // Attach both rejection handlers immediately: rapid page changes can cancel
        // rendering while text extraction is still running on a scanned page.
        const [, text] = await Promise.all([
          render.promise,
          pdfPage.getTextContent(),
        ]);
        if (!disposed)
          onText(
            text.items.map((item) => ("str" in item ? item.str : "")).join(" "),
          );
        if (!disposed) setLoading(false);
      } catch (reason) {
        if (
          !disposed &&
          !(
            reason instanceof Error &&
            reason.name === "RenderingCancelledException"
          )
        ) {
          setError("Unable to render this page. Try reopening the document.");
          setLoading(false);
        }
      }
    })();
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [document, page, width, zoom, onText]);
  return (
    <div className="pdf-stage" ref={container}>
      {loading && (
        <div className="pdf-loading">
          <LoaderCircle className="spin" size={22} /> Opening your page…
        </div>
      )}
      {error ? (
        <div className="empty-state">
          <FileWarning size={30} />
          <p>{error}</p>
        </div>
      ) : (
        <canvas ref={canvas} aria-label={`PDF document, page ${page}`} />
      )}
    </div>
  );
}
