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
type PdfBlockType = "h1" | "h2" | "h3" | "bullet" | "paragraph";

interface PdfBlock {
  type: PdfBlockType;
  text: string;
}

const formats: { id: Format; icon: typeof FileText; name: string; desc: string }[] = [
  { id: "pdf", icon: FileText, name: "PDF", desc: "Best for printing & sharing" },
  { id: "epub", icon: BookOpen, name: "EPUB", desc: "Perfect for e-readers" },
  { id: "mobi", icon: Smartphone, name: "MOBI", desc: "Optimized for Kindle" },
];

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function sanitizeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "book";
}

function cleanInlineFormatting(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

function normalizeToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseBlocks(content: string) {
  const normalized = normalizeToPlainText(content);
  const lines = normalized.split("\n");
  const blocks: PdfBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    const text = cleanInlineFormatting(paragraphBuffer.join(" "));
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const text = cleanInlineFormatting(heading[2]);
      blocks.push({
        type: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
        text,
      });
      continue;
    }

    const bullet = line.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: "bullet", text: cleanInlineFormatting(bullet[2]) });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: "(No content)" }];
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

async function downloadRemoteFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Remote download failed");
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    try {
      triggerBrowserDownload(blobUrl, fileName);
    } finally {
      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 5000);
    }

    return;
  } catch {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
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
    putOnlyUsedFonts: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentTop = 84;
  const contentBottom = pageHeight - 68;
  const contentWidth = pageWidth - margin * 2;
  const centerX = pageWidth / 2;
  let y = contentTop;

  const startNewPage = () => {
    doc.addPage();
    y = contentTop;
  };

  const ensurePageSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= contentBottom) {
      return;
    }

    startNewPage();
  };

  const writeParagraphLines = (text: string, fontSize: number, lineHeight: number, spacingAfter: number) => {
    const cleaned = cleanInlineFormatting(text);
    if (!cleaned) {
      y += spacingAfter;
      return;
    }

    const lines = doc.splitTextToSize(cleaned, contentWidth) as string[];

    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);

    for (const line of lines) {
      ensurePageSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }

    y += spacingAfter;
  };

  const writeHeading = (text: string, size: number, spacingBefore: number, spacingAfter: number) => {
    y += spacingBefore;
    ensurePageSpace(size + spacingAfter + 8);
    doc.setFont("times", "bold");
    doc.setFontSize(size);
    doc.text(cleanInlineFormatting(text), margin, y);
    y += size + spacingAfter;
  };

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  if (input.includeCover && input.book.coverUrl) {
    try {
      const imageData = await fetchImageDataUrl(input.book.coverUrl);
      const imageType = imageData.startsWith("data:image/png") ? "PNG" : "JPEG";
      const maxCoverWidth = pageWidth * 0.56;
      const maxCoverHeight = pageHeight * 0.44;
      const imageX = (pageWidth - maxCoverWidth) / 2;
      const imageY = 74;
      doc.addImage(imageData, imageType, imageX, imageY, maxCoverWidth, maxCoverHeight, undefined, "FAST");
      y = imageY + maxCoverHeight + 44;
    } catch {
      y = pageHeight * 0.42;
    }
  } else {
    y = pageHeight * 0.42;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.text(input.book.title || "Untitled Book", centerX, y, { align: "center", maxWidth: pageWidth - 120 });

  y += 34;
  if (input.book.genre) {
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text(input.book.genre, centerX, y, { align: "center" });
    y += 22;
  }

  const description = normalizeToPlainText(input.book.description || "");
  if (description) {
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const descLines = doc.splitTextToSize(description, pageWidth - 160) as string[];
    descLines.slice(0, 8).forEach((line) => {
      doc.text(line, centerX, y, { align: "center" });
      y += 16;
    });
  }

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated by Makia on ${new Date().toLocaleDateString()}`, centerX, pageHeight - 48, { align: "center" });

  if (input.includeToc && orderedChapters.length > 0) {
    startNewPage();
    doc.setTextColor(15, 23, 42);
    writeHeading("Table of Contents", 20, 0, 12);

    doc.setFont("times", "normal");
    doc.setFontSize(12);
    orderedChapters.forEach((chapter, index) => {
      ensurePageSpace(20);
      const chapterLabel = chapter.title || `Chapter ${index + 1}`;
      doc.text(`${index + 1}. ${cleanInlineFormatting(chapterLabel)}`, margin, y);
      y += 20;
    });
  }

  if (orderedChapters.length === 0) {
    startNewPage();
    doc.setTextColor(15, 23, 42);
    writeHeading("No Chapters Yet", 20, 10, 10);
    writeParagraphLines(
      "This book currently has no chapters. Add content in the editor and export again.",
      12,
      18,
      0
    );
  } else {
    orderedChapters.forEach((chapter, chapterIndex) => {
      startNewPage();
      doc.setTextColor(15, 23, 42);
      doc.setFont("times", "italic");
      doc.setFontSize(11);
      doc.text(`CHAPTER ${chapterIndex + 1}`, margin, y);
      y += 24;

      const chapterTitle = chapter.title || `Chapter ${chapterIndex + 1}`;
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text(cleanInlineFormatting(chapterTitle), margin, y, { maxWidth: contentWidth });
      y += 30;

      const blocks = parseBlocks(chapter.content);

      blocks.forEach((block) => {
        switch (block.type) {
          case "h1":
            writeHeading(block.text, 18, 6, 8);
            break;
          case "h2":
            writeHeading(block.text, 16, 6, 8);
            break;
          case "h3":
            writeHeading(block.text, 14, 4, 6);
            break;
          case "bullet": {
            const bulletIndent = 14;
            const bulletWidth = contentWidth - bulletIndent;
            const lines = doc.splitTextToSize(block.text, bulletWidth) as string[];

            doc.setFont("times", "normal");
            doc.setFontSize(12);
            lines.forEach((line, index) => {
              ensurePageSpace(18);
              if (index === 0) {
                doc.text("•", margin, y);
              }
              doc.text(line, margin + bulletIndent, y);
              y += 18;
            });
            y += 4;
            break;
          }
          default:
            writeParagraphLines(block.text, 12, 18, 8);
            break;
        }
      });
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 2; page <= totalPages; page += 1) {
    doc.setPage(page);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 44, pageWidth - margin, 44);

    doc.setTextColor(100, 116, 139);
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text(cleanInlineFormatting(input.book.title || "Untitled Book"), margin, 36, {
      maxWidth: contentWidth,
    });
  }

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(100, 116, 139);
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text(`${page}`, centerX, pageHeight - 24, { align: "center" });
  }

  doc.setProperties({
    title: input.book.title || "Untitled Book",
    author: "Makia",
    subject: normalizeToPlainText(input.book.description || "") || "Book export",
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
  const maxAttempts = 120;
  let queuedCount = 0;
  let processingCount = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await getBookExportStatus(jobId);

    if (status.status === "DONE" || status.status === "FAILED") {
      return status;
    }

    if (status.status === "QUEUED") {
      queuedCount += 1;
      if (queuedCount >= 25) {
        throw new Error("Export is still queued. Ensure backend export worker is running (`cd Backend && npm run worker:export`).");
      }
    } else if (status.status === "PROCESSING") {
      processingCount += 1;
      if (processingCount >= 80) {
        throw new Error("Export is taking too long in processing. Check worker logs for conversion errors.");
      }
    }

    await wait(2000);
  }

  throw new Error("Export timed out. The export worker may be offline. Please try again shortly.");
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

  const hasChapters = chapters.length > 0;

  const steps = useMemo(() => {
    if (selected === "pdf") {
      return ["Preparing manuscript", "Composing pages", "Generating PDF", "Ready to download"];
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
      await wait(120);

      if (selected === "pdf") {
        setCurrentStep(2);
        await wait(120);

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

      setCurrentStep(3);
      const status = await pollExportUntilReady(created.jobId);

      if (status.status === "FAILED") {
        throw new Error(status.errorMessage || `${selected.toUpperCase()} export failed`);
      }

      if (!status.fileUrl) {
        throw new Error("Export finished but file URL was missing. Please retry.");
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

    void downloadRemoteFile(downloadUrl, downloadName || `${sanitizeFileName(book.title)}.${selected}`);
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
                <p className="text-sm text-muted-foreground">EPUB and MOBI export runs on the backend worker and can take 10-60 seconds.</p>
              )}

              {!hasChapters ? (
                <p className="text-xs text-amber-600">This book has no chapters yet. You can still export, but content will be minimal.</p>
              ) : null}

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
