import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, FileText, BookOpen, Smartphone } from "lucide-react";
import { jsPDF } from "jspdf";

import {
  createBookExport,
  getBookExportStatus,
  type ApiBook,
  type ApiChapter,
  type ExportFormat,
} from "@/lib/api";

type Format = "pdf" | "epub" | "mobi";
type ExportStage = "select" | "progress" | "done";
type PageSize = "a4" | "letter" | "a5";

const formats: { id: Format; icon: typeof FileText; name: string; desc: string }[] = [
  { id: "pdf", icon: FileText, name: "PDF", desc: "Best for printing & sharing" },
  { id: "epub", icon: BookOpen, name: "EPUB", desc: "Perfect for e-readers" },
  { id: "mobi", icon: Smartphone, name: "MOBI", desc: "Optimized for Kindle" },
];

function sanitizeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "book";
}

function toPlainText(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchImageDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch cover image");
  }

  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Invalid cover data"));
    };

    reader.onerror = () => {
      reject(new Error("Failed to parse cover image"));
    };

    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function createPdf(input: {
  book: ApiBook;
  chapters: ApiChapter[];
  includeCover: boolean;
  includeToc: boolean;
  pageSize: PageSize;
}) {
  const orderedChapters = [...input.chapters].sort((a, b) => a.order - b.order);
  const doc = new jsPDF({
    format: input.pageSize,
    unit: "pt",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;
  const maxY = pageHeight - margin;
  let y = margin;

  const ensurePageSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= maxY) {
      return;
    }

    doc.addPage();
    y = margin;
  };

  const writeParagraph = (text: string, fontSize = 12, extraSpacing = 8) => {
    if (!text.trim()) {
      y += extraSpacing;
      return;
    }

    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];

    for (const line of lines) {
      ensurePageSpace(fontSize + 4);
      doc.text(line, margin, y);
      y += fontSize + 4;
    }

    y += extraSpacing;
  };

  if (input.includeCover && input.book.coverUrl) {
    try {
      const imageData = await fetchImageDataUrl(input.book.coverUrl);
      const maxCoverWidth = contentWidth;
      const maxCoverHeight = pageHeight * 0.45;
      const imageType = imageData.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(imageData, imageType, margin, margin, maxCoverWidth, maxCoverHeight, undefined, "FAST");
      y = margin + maxCoverHeight + 28;
    } catch {
      // Cover export should not fail because of external image/CORS issues.
    }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.text(input.book.title || "Untitled Book", margin, y);
  y += 30;

  if (input.book.description) {
    writeParagraph(toPlainText(input.book.description), 12, 14);
  }

  if (input.includeToc && orderedChapters.length > 0) {
    ensurePageSpace(40);
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("Table of Contents", margin, y);
    y += 22;

    doc.setFont("times", "normal");
    doc.setFontSize(12);

    orderedChapters.forEach((chapter, index) => {
      ensurePageSpace(18);
      doc.text(`${index + 1}. ${chapter.title || `Chapter ${index + 1}`}`, margin, y);
      y += 18;
    });

    doc.addPage();
    y = margin;
  } else {
    doc.addPage();
    y = margin;
  }

  orderedChapters.forEach((chapter, index) => {
    ensurePageSpace(30);
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text(chapter.title || `Chapter ${index + 1}`, margin, y);
    y += 24;

    const paragraphBlocks = toPlainText(chapter.content).split(/\n{2,}/).map((value) => value.trim());

    if (paragraphBlocks.length === 0 || (paragraphBlocks.length === 1 && paragraphBlocks[0].length === 0)) {
      writeParagraph("(No content)", 12, 16);
    } else {
      paragraphBlocks.forEach((block) => {
        writeParagraph(block, 12, 8);
      });
      y += 8;
    }

    if (index < orderedChapters.length - 1) {
      doc.addPage();
      y = margin;
    }
  });

  doc.setProperties({
    title: input.book.title || "Untitled Book",
    author: "Makia",
    subject: input.book.description || "Exported book",
  });

  const blob = doc.output("blob");
  const fileName = `${sanitizeFileName(input.book.title)}.pdf`;
  const blobUrl = URL.createObjectURL(blob);

  try {
    triggerBrowserDownload(blobUrl, fileName);
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 5000);
  }

  return fileName;
}

async function pollExportUntilReady(jobId: string) {
  const maxAttempts = 80;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await getBookExportStatus(jobId);

    if (status.status === "DONE" || status.status === "FAILED") {
      return status;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 1500);
    });
  }

  throw new Error("Export timed out. Please try again.");
}

const ExportModal = ({
  onClose,
  book,
  chapters,
}: {
  onClose: () => void;
  book: ApiBook;
  chapters: ApiChapter[];
}) => {
  const [selected, setSelected] = useState<Format>("pdf");
  const [stage, setStage] = useState<ExportStage>("select");
  const [includeCover, setIncludeCover] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [currentStep, setCurrentStep] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(() => {
    if (selected === "pdf") {
      return ["Preparing content", "Laying out pages", "Generating PDF", "Ready to download"];
    }

    return ["Preparing content", "Submitting export job", "Processing export", "Ready to download"];
  }, [selected]);

  const startExport = async () => {
    setStage("progress");
    setCurrentStep(0);
    setError(null);
    setDownloadUrl(null);
    setDownloadName("");

    try {
      setCurrentStep(1);

      if (selected === "pdf") {
        setCurrentStep(2);
        const name = await createPdf({
          book,
          chapters,
          includeCover,
          includeToc,
          pageSize,
        });
        setDownloadName(name);
        setCurrentStep(4);
        setStage("done");
        return;
      }

      setCurrentStep(2);
      const format = selected.toUpperCase() as ExportFormat;
      const created = await createBookExport(book.id, format);
      const status = await pollExportUntilReady(created.jobId);

      if (status.status === "FAILED") {
        throw new Error(status.errorMessage || "Export failed");
      }

      if (!status.fileUrl) {
        throw new Error("Export completed but no file URL was returned");
      }

      setCurrentStep(4);
      setDownloadUrl(status.fileUrl);
      setDownloadName(`${sanitizeFileName(book.title)}.${selected}`);
      setStage("done");
    } catch (exportError) {
      setStage("select");
      setCurrentStep(0);
      setError(exportError instanceof Error ? exportError.message : "Export failed");
    }
  };

  const handleDownload = () => {
    if (selected === "pdf") {
      void createPdf({
        book,
        chapters,
        includeCover,
        includeToc,
        pageSize,
      });
      return;
    }

    if (!downloadUrl) {
      return;
    }

    triggerBrowserDownload(downloadUrl, downloadName || `${sanitizeFileName(book.title)}.${selected}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Export Your Book</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          {stage === "select" && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {formats.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                      selected === f.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    {selected === f.id && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </span>
                    )}
                    <f.icon className={`w-6 h-6 mx-auto mb-2 ${selected === f.id ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-semibold text-sm text-foreground">{f.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                  </button>
                ))}
              </div>

              {selected === "pdf" ? (
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Include cover</span>
                    <button
                      onClick={() => setIncludeCover(!includeCover)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${includeCover ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-card shadow transition-all ${includeCover ? "left-5" : "left-1"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Include table of contents</span>
                    <button
                      onClick={() => setIncludeToc(!includeToc)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${includeToc ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-card shadow transition-all ${includeToc ? "left-5" : "left-1"}`} />
                    </button>
                  </label>
                  <div>
                    <label className="text-sm text-foreground block mb-1.5">Page size</label>
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(event.target.value as PageSize)}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="a4">A4</option>
                      <option value="letter">Letter</option>
                      <option value="a5">A5</option>
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">EPUB and MOBI export uses the server worker and may take a moment.</p>
              )}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <button
                onClick={() => void startExport()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm hover:scale-[1.02] btn-press"
              >
                Start Export
              </button>
            </div>
          )}

          {stage === "progress" && (
            <div className="space-y-4 py-4">
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                    i < currentStep ? "bg-success text-success-foreground" : i === currentStep ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground"
                  }`}>
                    {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-sm ${i <= currentStep ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                </motion.div>
              ))}
            </div>
          )}

          {stage === "done" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-success">
                  <path
                    d="M5 13l4 4L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="100"
                    className="animate-draw-check"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">Your {selected.toUpperCase()} is ready!</p>
                {downloadName ? <p className="text-sm text-muted-foreground">{downloadName}</p> : null}
              </div>
              <button
                onClick={handleDownload}
                className="w-full py-3 rounded-xl bg-success text-success-foreground font-medium shadow-sm hover:scale-[1.02] btn-press"
              >
                Download {selected.toUpperCase()}
              </button>
              <button
                onClick={() => {
                  setStage("select");
                  setCurrentStep(0);
                  setDownloadUrl(null);
                  setDownloadName("");
                  setError(null);
                }}
                className="text-sm text-primary hover:underline"
              >
                Export another format
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ExportModal;
