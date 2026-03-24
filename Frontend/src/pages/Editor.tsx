import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, GripVertical, X, Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Image, Table,
  Undo, Redo, Clock, SlidersHorizontal, Download, Trash2
} from "lucide-react";

import ExportModal from "@/components/ExportModal";
import { collaborators } from "@/lib/mockData";
import {
  createChapter,
  deleteChapter,
  getBook,
  getChapters,
  updateChapter,
  type ApiBook,
  type ApiChapter,
} from "@/lib/api";

const toolbarGroups = [
  [
    { icon: Bold, label: "Bold" },
    { icon: Italic, label: "Italic" },
    { icon: Underline, label: "Underline" },
    { icon: Strikethrough, label: "Strikethrough" },
  ],
  [
    { icon: Heading1, label: "H1" },
    { icon: Heading2, label: "H2" },
    { icon: Heading3, label: "H3" },
  ],
  [
    { icon: List, label: "Bullet List" },
    { icon: ListOrdered, label: "Numbered List" },
  ],
  [
    { icon: Image, label: "Image" },
    { icon: Table, label: "Table" },
  ],
  [
    { icon: Undo, label: "Undo" },
    { icon: Redo, label: "Redo" },
  ],
];

function plainTextWordCount(content: string) {
  const text = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) {
    return 0;
  }

  return text.split(" ").length;
}

const EditorPage = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const [activeChapter, setActiveChapter] = useState<string>("");
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>(["Bold"]);

  const [book, setBook] = useState<ApiBook | null>(null);
  const [chapters, setChapters] = useState<ApiChapter[]>([]);
  const [editorHtml, setEditorHtml] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      navigate("/dashboard");
      return;
    }

    let active = true;

    const run = async () => {
      try {
        const [bookResult, chapterResult] = await Promise.all([
          getBook(bookId),
          getChapters(bookId),
        ]);

        if (!active) {
          return;
        }

        setBook(bookResult);
        setChapters(chapterResult);

        if (chapterResult.length > 0) {
          setActiveChapter(chapterResult[0].id);
          setEditorHtml(chapterResult[0].content || "");
        }
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load editor";
        if (message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("access token")) {
          navigate("/login");
          return;
        }

        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [bookId, navigate]);

  const chapterEntries = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  );

  const selectedChapter = useMemo(
    () => chapterEntries.find((chapter) => chapter.id === activeChapter) ?? null,
    [activeChapter, chapterEntries]
  );

  const totalWords = useMemo(
    () => chapterEntries.reduce((sum, chapter) => sum + plainTextWordCount(chapter.content), 0),
    [chapterEntries]
  );

  useEffect(() => {
    if (selectedChapter) {
      setEditorHtml(selectedChapter.content || "");
      setLastSavedContent(selectedChapter.content || "");
    } else {
      setEditorHtml("");
      setLastSavedContent("");
    }
  }, [selectedChapter]);

  const toggleTool = (label: string) => {
    setActiveTools((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  const handleSaveChapter = async () => {
    if (!selectedChapter) {
      return;
    }

    if (editorHtml === lastSavedContent) {
      return;
    }

    setIsSaving(true);

    try {
      const updated = await updateChapter(selectedChapter.id, {
        content: editorHtml,
      });

      setChapters((prev) => prev.map((chapter) => (chapter.id === updated.id ? updated : chapter)));
      setLastSavedContent(editorHtml);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save chapter");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedChapter || editorHtml === lastSavedContent) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void handleSaveChapter();
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [editorHtml, lastSavedContent, selectedChapter]);

  const handleSelectChapter = async (chapterId: string) => {
    if (chapterId === activeChapter) {
      return;
    }

    if (selectedChapter && editorHtml !== lastSavedContent) {
      await handleSaveChapter();
    }

    setActiveChapter(chapterId);
  };

  const handleCreateChapter = async () => {
    if (!bookId) {
      return;
    }

    const nextIndex = chapterEntries.length + 1;

    try {
      const chapter = await createChapter(bookId, {
        title: `Chapter ${nextIndex}`,
        content: "",
      });

      const nextChapters = [...chapterEntries, chapter].sort((a, b) => a.order - b.order);
      setChapters(nextChapters);
      setActiveChapter(chapter.id);
      setEditorHtml(chapter.content);
      setLastSavedContent(chapter.content);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create chapter");
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (deletingChapterId) {
      return;
    }

    const current = chapterEntries.find((chapter) => chapter.id === chapterId);
    if (!current) {
      return;
    }

    const index = chapterEntries.findIndex((chapter) => chapter.id === chapterId);
    const nextChapter =
      chapterEntries[index + 1] ??
      chapterEntries[index - 1] ??
      null;

    setDeletingChapterId(chapterId);
    setError(null);

    try {
      await deleteChapter(chapterId);
      setChapters((prev) => prev.filter((chapter) => chapter.id !== chapterId));

      if (activeChapter === chapterId) {
        setActiveChapter(nextChapter?.id ?? "");
        setEditorHtml(nextChapter?.content ?? "");
        setLastSavedContent(nextChapter?.content ?? "");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete chapter");
    } finally {
      setDeletingChapterId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-8 text-muted-foreground">Loading editor...</div>;
  }

  if (!book) {
    return <div className="min-h-screen p-8 text-destructive">{error || "Book not found"}</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="h-14 bg-card border-b border-border flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-medium text-foreground text-sm">{book.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            <span className={`w-2 h-2 rounded-full ${isSaving ? "bg-warning animate-pulse" : "bg-success"}`} />
            {isSaving ? "Saving..." : editorHtml === lastSavedContent ? "Saved" : "Unsaved changes"}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="flex -space-x-2">
            {collaborators.map((c, i) => (
              <div key={i} className="relative" title={`${c.name} is editing`}>
                <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover border-2 border-card" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-card" />
              </div>
            ))}
          </div>
          <div className="w-px h-6 bg-border" />
          <button
            onClick={() => { setShowHistory(!showHistory); setShowDetails(false); }}
            className={`p-2 rounded-lg transition-colors ${showHistory ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowDetails(!showDetails); setShowHistory(false); }}
            className={`p-2 rounded-lg transition-colors ${showDetails ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:scale-[1.02] btn-press"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-card border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <Link to="/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors inline-flex text-muted-foreground mb-3">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <img
                src={book.coverUrl || "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=260&h=180&fit=crop"}
                alt=""
                className="w-10 h-14 rounded-lg object-cover"
              />
              <h3 className="font-semibold text-sm text-foreground leading-tight">{book.title}</h3>
            </div>
          </div>

          <div className="p-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chapters</span>
            <button onClick={handleCreateChapter} className="p-1 rounded-md hover:bg-muted transition-colors">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {chapterEntries.map((chapter, index) => {
              const wordCount = plainTextWordCount(chapter.content);
              return (
                <div
                  key={chapter.id}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group flex items-center gap-2 ${
                    activeChapter === chapter.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <button
                    onClick={() => void handleSelectChapter(chapter.id)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <GripVertical className={`w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0 ${activeChapter === chapter.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Ch. {index + 1} — {chapter.title}</p>
                      <p className={`text-xs ${activeChapter === chapter.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {wordCount.toLocaleString()} words
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteChapter(chapter.id);
                    }}
                    disabled={deletingChapterId === chapter.id}
                    className={`p-1 rounded-md transition-colors ${
                      activeChapter === chapter.id
                        ? "hover:bg-primary-foreground/20"
                        : "hover:bg-muted"
                    } disabled:opacity-60`}
                    title="Delete chapter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-border space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalWords.toLocaleString()} words</span>
              <span>~{Math.ceil(totalWords / 250)} min read</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto my-8">
            <div className="bg-card rounded-2xl shadow-sm border border-border">
              <div className="sticky top-0 z-10 bg-card border-b border-border rounded-t-2xl px-4 py-2.5 flex items-center gap-1 flex-wrap">
                {toolbarGroups.map((group, gi) => (
                  <div key={gi} className="flex items-center gap-0.5">
                    {group.map((tool) => (
                      <button
                        key={tool.label}
                        onClick={() => toggleTool(tool.label)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          activeTools.includes(tool.label)
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                        title={tool.label}
                      >
                        <tool.icon className="w-4 h-4" />
                      </button>
                    ))}
                    {gi < toolbarGroups.length - 1 && <div className="w-px h-5 bg-border mx-1" />}
                  </div>
                ))}
              </div>

              {selectedChapter ? (
                <textarea
                  value={editorHtml}
                  onChange={(event) => setEditorHtml(event.target.value)}
                  onBlur={() => void handleSaveChapter()}
                  className="w-full px-16 py-12 min-h-[60vh] bg-transparent text-foreground leading-relaxed focus:outline-none resize-none"
                  placeholder="Start writing..."
                />
              ) : (
                <div className="px-16 py-12 min-h-[60vh] flex items-center justify-center text-muted-foreground">
                  No chapters yet. Create one to start writing.
                </div>
              )}
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-80 bg-card border-l border-border shadow-lg overflow-y-auto shrink-0"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Book Details</h3>
                <button onClick={() => setShowDetails(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-5">
                <div>
                  <img
                    src={book.coverUrl || "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=260&h=180&fit=crop"}
                    alt=""
                    className="w-full h-48 object-cover rounded-xl mb-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
                  <p className="text-sm text-foreground/90">{book.description || "No description"}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Genre</label>
                  <p className="text-sm text-foreground/90">{book.genre || "General"}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-80 bg-card border-l border-border shadow-lg overflow-y-auto shrink-0"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Version History</h3>
                <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 text-sm text-muted-foreground">Version history route is available on backend; UI fetch can be added next.</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  );
};

export default EditorPage;
