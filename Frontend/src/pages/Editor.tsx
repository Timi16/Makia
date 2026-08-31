import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, GripVertical, X, Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Image, Table,
  Undo, Redo, Clock, SlidersHorizontal, Download, Trash2, Menu, Users
} from "lucide-react";
import type * as Y from "yjs";

import ExportModal from "@/components/ExportModal";
import PresenceAvatars from "@/components/PresenceAvatars";
import ShareBookModal from "@/components/ShareBookModal";
import {
  createChapter,
  deleteChapter,
  getBook,
  getChapters,
  getCurrentUser,
  uploadBookCover,
  updateChapter,
  type ApiBook,
  type ApiChapter,
} from "@/lib/api";
import {
  applyTextDiff,
  BookRealtime,
  LOCAL_ORIGIN,
  transformCursor,
  type PresenceUser,
  type RealtimeStatus,
} from "@/lib/realtime";

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
  const [showChapters, setShowChapters] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>(["Bold"]);

  const [book, setBook] = useState<ApiBook | null>(null);
  const [chapters, setChapters] = useState<ApiChapter[]>([]);
  const [chapterTitle, setChapterTitle] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [realtimeSynced, setRealtimeSynced] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const realtimeRef = useRef<BookRealtime | null>(null);
  const editorHtmlRef = useRef("");
  const lastSavedContentRef = useRef("");
  const chapterTitleRef = useRef("");
  const lastSavedTitleRef = useRef("");
  const activeChapterRef = useRef("");
  const boundChapterRef = useRef("");
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const currentUser = useMemo(() => getCurrentUser(), []);

  const accessRole = book?.accessRole ?? "OWNER";
  const canEdit = accessRole !== "VIEWER";
  const isOwner = accessRole === "OWNER";
  const isLive = realtimeStatus === "connected" && realtimeSynced;

  useEffect(() => {
    editorHtmlRef.current = editorHtml;
  }, [editorHtml]);

  useEffect(() => {
    lastSavedContentRef.current = lastSavedContent;
  }, [lastSavedContent]);

  useEffect(() => {
    chapterTitleRef.current = chapterTitle;
  }, [chapterTitle]);

  useEffect(() => {
    lastSavedTitleRef.current = lastSavedTitle;
  }, [lastSavedTitle]);

  useEffect(() => {
    activeChapterRef.current = activeChapter;
    realtimeRef.current?.sendPresence(activeChapter || null);
  }, [activeChapter]);

  const pushHistory = (nextValue: string) => {
    const current = historyRef.current[historyIndexRef.current];
    if (current === nextValue) {
      return;
    }

    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(nextValue);
    historyRef.current = trimmed.slice(-200);
    historyIndexRef.current = historyRef.current.length - 1;
  };

  /**
   * Single entry point for every local content change: updates the editor,
   * the undo history, and (once the shared document is available) the Yjs
   * text so other collaborators receive the edit.
   */
  const commitLocalContent = (nextValue: string, options: { history?: boolean } = {}) => {
    setEditorHtml(nextValue);
    editorHtmlRef.current = nextValue;

    if (options.history !== false) {
      pushHistory(nextValue);
    }

    const realtime = realtimeRef.current;
    const chapterId = boundChapterRef.current;

    if (realtime && realtime.hasSyncedOnce && chapterId) {
      applyTextDiff(realtime.getText(chapterId), nextValue);
      setPendingSync(true);
    }
  };

  /** Re-fetches book + chapters after another collaborator changed them. */
  const refreshBookAndChapters = async () => {
    if (!bookId) {
      return;
    }

    try {
      const [bookResult, chapterResult] = await Promise.all([getBook(bookId), getChapters(bookId)]);
      const realtime = realtimeRef.current;

      setBook(bookResult);
      setChapters(
        chapterResult.map((chapter) => {
          if (!realtime?.hasSyncedOnce) {
            return chapter;
          }

          const liveContent = realtime.getText(chapter.id).toString();
          return liveContent.length > 0 ? { ...chapter, content: liveContent } : chapter;
        })
      );

      const active = chapterResult.find((chapter) => chapter.id === activeChapterRef.current);

      if (!active) {
        setActiveChapter(chapterResult[0]?.id ?? "");
        return;
      }

      if (active.title !== lastSavedTitleRef.current) {
        const titleUntouched = chapterTitleRef.current === lastSavedTitleRef.current;
        setLastSavedTitle(active.title);
        if (titleUntouched) {
          setChapterTitle(active.title);
        }
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh book");
    }
  };

  refreshRef.current = refreshBookAndChapters;

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

  // Realtime collaboration session for this book.
  useEffect(() => {
    if (!bookId || !book) {
      return;
    }

    const realtime = new BookRealtime(bookId, {
      onStatus: (status) => {
        setRealtimeStatus(status);

        if (status !== "connected") {
          setRealtimeSynced(false);
        }

        if (status === "revoked") {
          navigate("/dashboard");
        }
      },
      onReady: (_role, id) => setConnectionId(id),
      onPresence: setPresence,
      onSynced: () => {
        setRealtimeSynced(true);
        realtime.sendPresence(activeChapterRef.current || null);
      },
      onSaved: (chapterIds) => {
        setChapters((prev) =>
          prev.map((chapter) =>
            chapterIds.includes(chapter.id)
              ? {
                  ...chapter,
                  content: realtime.getText(chapter.id).toString(),
                  updatedAt: new Date().toISOString(),
                }
              : chapter
          )
        );

        if (chapterIds.includes(activeChapterRef.current)) {
          setLastSavedContent(editorHtmlRef.current);
          setPendingSync(false);
        }
      },
      onBookChanged: () => {
        void refreshRef.current();
      },
    });

    realtimeRef.current = realtime;

    return () => {
      realtime.destroy();
      realtimeRef.current = null;
      setRealtimeSynced(false);
      setPresence([]);
      setConnectionId(null);
    };
    // Reconnect only when the book itself changes, not on every metadata update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, book?.id, navigate]);

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

  const chapterLabels = useMemo(
    () =>
      Object.fromEntries(
        chapterEntries.map((chapter, index) => [chapter.id, `Ch. ${index + 1} — ${chapter.title}`])
      ) as Record<string, string>,
    [chapterEntries]
  );

  // Binds the editor to the selected chapter: plain REST content until the
  // shared document arrives, then the chapter's Y.Text (with remote updates
  // streamed into the textarea).
  useEffect(() => {
    const realtime = realtimeRef.current;
    const chapter = selectedChapter;

    if (!chapter) {
      setChapterTitle("");
      setLastSavedTitle("");
      setEditorHtml("");
      editorHtmlRef.current = "";
      setLastSavedContent("");
      lastSavedContentRef.current = "";
      historyRef.current = [""];
      historyIndexRef.current = 0;
      boundChapterRef.current = "";
      return;
    }

    setChapterTitle(chapter.title || "");
    setLastSavedTitle(chapter.title || "");

    let content = chapter.content || "";
    let text: Y.Text | null = null;

    if (realtime && realtimeSynced) {
      text = realtime.getText(chapter.id);
      const sameChapter = boundChapterRef.current === chapter.id;
      const localDirty = sameChapter && editorHtmlRef.current !== lastSavedContentRef.current;

      if (localDirty && canEdit) {
        // Typed before the shared document arrived: merge those edits in.
        applyTextDiff(text, editorHtmlRef.current);
      }

      content = text.toString();
    }

    boundChapterRef.current = chapter.id;
    setEditorHtml(content);
    editorHtmlRef.current = content;
    setLastSavedContent(content);
    lastSavedContentRef.current = content;
    setPendingSync(false);
    historyRef.current = [content];
    historyIndexRef.current = 0;

    if (!text) {
      return;
    }

    const boundText = text;
    const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      if (transaction.origin === LOCAL_ORIGIN) {
        return;
      }

      const value = boundText.toString();
      const textarea = textareaRef.current;

      if (textarea && document.activeElement === textarea) {
        const start = transformCursor(event.delta, textarea.selectionStart);
        const end = transformCursor(event.delta, textarea.selectionEnd);
        window.requestAnimationFrame(() => textarea.setSelectionRange(start, end));
      }

      editorHtmlRef.current = value;
      setEditorHtml(value);
      lastSavedContentRef.current = value;
      setLastSavedContent(value);
      setChapters((prev) => prev.map((entry) => (entry.id === chapter.id ? { ...entry, content: value } : entry)));
    };

    boundText.observe(observer);

    return () => {
      boundText.unobserve(observer);
    };
    // Re-bind only when the chapter or sync state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter?.id, realtimeSynced, canEdit]);

  const toggleTool = (label: string) => {
    setActiveTools((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  const applyTextEdit = (
    updater: (input: {
      value: string;
      selectionStart: number;
      selectionEnd: number;
    }) => { value: string; selectionStart: number; selectionEnd: number }
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const result = updater({
      value: editorHtml,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    });

    commitLocalContent(result.value);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const wrapSelection = (prefix: string, suffix: string, fallback: string) => {
    applyTextEdit(({ value, selectionStart, selectionEnd }) => {
      const selected = value.slice(selectionStart, selectionEnd) || fallback;
      const next = `${value.slice(0, selectionStart)}${prefix}${selected}${suffix}${value.slice(selectionEnd)}`;
      const start = selectionStart + prefix.length;
      const end = start + selected.length;
      return { value: next, selectionStart: start, selectionEnd: end };
    });
  };

  const prefixSelectedLines = (mapper: (line: string, index: number) => string) => {
    applyTextEdit(({ value, selectionStart, selectionEnd }) => {
      const blockStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
      const endBoundary = value.indexOf("\n", selectionEnd);
      const blockEnd = endBoundary === -1 ? value.length : endBoundary;
      const selectedBlock = value.slice(blockStart, blockEnd);
      const lines = selectedBlock.split("\n");
      const mapped = lines.map((line, index) => mapper(line, index)).join("\n");
      const next = `${value.slice(0, blockStart)}${mapped}${value.slice(blockEnd)}`;
      return {
        value: next,
        selectionStart: blockStart,
        selectionEnd: blockStart + mapped.length,
      };
    });
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) {
      return;
    }

    historyIndexRef.current -= 1;
    const previous = historyRef.current[historyIndexRef.current] ?? "";
    commitLocalContent(previous, { history: false });
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }

    historyIndexRef.current += 1;
    const next = historyRef.current[historyIndexRef.current] ?? "";
    commitLocalContent(next, { history: false });
  };

  const handleToolAction = (label: string) => {
    setActiveTools((prev) =>
      prev.includes(label) ? prev : [...prev, label]
    );

    switch (label) {
      case "Bold":
        wrapSelection("**", "**", "bold text");
        break;
      case "Italic":
        wrapSelection("*", "*", "italic text");
        break;
      case "Underline":
        wrapSelection("<u>", "</u>", "underlined text");
        break;
      case "Strikethrough":
        wrapSelection("~~", "~~", "strikethrough text");
        break;
      case "H1":
        prefixSelectedLines((line) => `# ${line.replace(/^#+\s*/, "")}`);
        break;
      case "H2":
        prefixSelectedLines((line) => `## ${line.replace(/^#+\s*/, "")}`);
        break;
      case "H3":
        prefixSelectedLines((line) => `### ${line.replace(/^#+\s*/, "")}`);
        break;
      case "Bullet List":
        prefixSelectedLines((line) => `- ${line.replace(/^[-*]\s+/, "")}`);
        break;
      case "Numbered List":
        prefixSelectedLines((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s+/, "")}`);
        break;
      case "Image":
        applyTextEdit(({ value, selectionStart, selectionEnd }) => {
          const snippet = "\n![Image description](https://example.com/image.jpg)\n";
          const next = `${value.slice(0, selectionStart)}${snippet}${value.slice(selectionEnd)}`;
          const cursor = selectionStart + snippet.length;
          return { value: next, selectionStart: cursor, selectionEnd: cursor };
        });
        break;
      case "Table":
        applyTextEdit(({ value, selectionStart, selectionEnd }) => {
          const snippet = "\n| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |\n";
          const next = `${value.slice(0, selectionStart)}${snippet}${value.slice(selectionEnd)}`;
          const cursor = selectionStart + snippet.length;
          return { value: next, selectionStart: cursor, selectionEnd: cursor };
        });
        break;
      case "Undo":
        handleUndo();
        break;
      case "Redo":
        handleRedo();
        break;
      default:
        toggleTool(label);
    }
  };

  /**
   * Saves through the REST API. While the realtime session is live the server
   * persists chapter content itself, so only the title goes through here.
   */
  const handleSaveChapter = async () => {
    if (!selectedChapter || !canEdit) {
      return;
    }

    const live = realtimeRef.current?.isLive ?? false;
    const titleChanged = chapterTitle !== lastSavedTitle;
    const contentChanged = !live && editorHtml !== lastSavedContent;

    if (!titleChanged && !contentChanged) {
      return;
    }

    setIsSaving(true);

    try {
      const updated = await updateChapter(selectedChapter.id, {
        ...(titleChanged ? { title: chapterTitle.trim() || "Untitled Chapter" } : {}),
        ...(contentChanged ? { content: editorHtml } : {}),
      });

      setChapters((prev) =>
        prev.map((chapter) =>
          chapter.id === updated.id ? { ...updated, content: live ? chapter.content : updated.content } : chapter
        )
      );
      setLastSavedTitle(updated.title);

      if (contentChanged) {
        setLastSavedContent(editorHtml);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save chapter");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedChapter || !canEdit) {
      return;
    }

    const titleChanged = chapterTitle !== lastSavedTitle;
    const contentChanged = !isLive && editorHtml !== lastSavedContent;

    if (!titleChanged && !contentChanged) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void handleSaveChapter();
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
    // handleSaveChapter is recreated each render; its inputs are listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHtml, lastSavedContent, chapterTitle, lastSavedTitle, selectedChapter, isLive, canEdit]);

  const handleSelectChapter = async (chapterId: string) => {
    if (chapterId === activeChapter) {
      return;
    }

    if (
      selectedChapter &&
      (editorHtml !== lastSavedContent || chapterTitle !== lastSavedTitle)
    ) {
      await handleSaveChapter();
    }

    setActiveChapter(chapterId);
    setShowChapters(false);
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
      setChapterTitle(chapter.title);
      setLastSavedTitle(chapter.title);
      setEditorHtml(chapter.content);
      setLastSavedContent(chapter.content);
      setShowChapters(false);
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
        setChapterTitle(nextChapter?.title ?? "");
        setLastSavedTitle(nextChapter?.title ?? "");
        setEditorHtml(nextChapter?.content ?? "");
        setLastSavedContent(nextChapter?.content ?? "");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete chapter");
    } finally {
      setDeletingChapterId(null);
    }
  };

  const handleUploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !book) {
      return;
    }

    setIsUploadingCover(true);
    setError(null);

    try {
      const coverUrl = await uploadBookCover(book.id, file);
      setBook((prev) => (prev ? { ...prev, coverUrl } : prev));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload cover");
    } finally {
      setIsUploadingCover(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-8 text-muted-foreground">Loading editor...</div>;
  }

  if (!book) {
    return <div className="min-h-screen p-8 text-destructive">{error || "Book not found"}</div>;
  }

  const contentDirty = editorHtml !== lastSavedContent || chapterTitle !== lastSavedTitle;
  let statusLabel: string;
  let statusDotClass: string;

  if (!canEdit) {
    statusLabel = "View only";
    statusDotClass = "bg-muted-foreground";
  } else if (isSaving || (isLive && pendingSync)) {
    statusLabel = isLive ? "Syncing..." : "Saving...";
    statusDotClass = "bg-warning animate-pulse";
  } else if (realtimeStatus === "reconnecting" || realtimeStatus === "offline") {
    statusLabel = contentDirty ? "Unsaved changes" : "Saved · offline";
    statusDotClass = contentDirty ? "bg-warning" : "bg-muted-foreground";
  } else if (isLive) {
    statusLabel = "Saved · live";
    statusDotClass = "bg-success";
  } else {
    statusLabel = contentDirty ? "Unsaved changes" : "Saved";
    statusDotClass = contentDirty ? "bg-warning" : "bg-success";
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="bg-card border-b border-border flex items-center px-3 md:px-4 py-2 md:h-14 shrink-0 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setShowChapters((prev) => !prev)}
            className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            title="Toggle chapters"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-medium text-foreground text-sm truncate">{book.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 md:px-3 py-1.5 rounded-full">
            <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
            <span className="hidden md:inline">{statusLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-3 flex-1 justify-end min-w-0">
          <div className="hidden lg:flex items-center">
            <PresenceAvatars users={presence} currentConnectionId={connectionId} chapterLabels={chapterLabels} />
          </div>
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors"
            title={isOwner ? "Share this book" : "People with access"}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">{isOwner ? "Share" : "Shared"}</span>
          </button>
          <div className="hidden lg:block w-px h-6 bg-border" />
          <button
            onClick={() => { setShowHistory(!showHistory); setShowDetails(false); setShowChapters(false); }}
            className={`p-2 rounded-lg transition-colors ${showHistory ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowDetails(!showDetails); setShowHistory(false); setShowChapters(false); }}
            className={`p-2 rounded-lg transition-colors ${showDetails ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:scale-[1.02] btn-press"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showChapters ? (
          <button
            aria-label="Close chapters panel"
            className="fixed inset-0 z-30 bg-black/35 md:hidden"
            onClick={() => setShowChapters(false)}
          />
        ) : null}

        <div className={`fixed inset-y-0 left-0 z-40 w-[82vw] max-w-72 bg-card border-r border-border flex flex-col shrink-0 transition-transform duration-200 md:static md:w-64 md:translate-x-0 ${showChapters ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <Link to="/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors inline-flex text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <button onClick={() => setShowChapters(false)} className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
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
            {canEdit ? (
              <button onClick={handleCreateChapter} className="p-1 rounded-md hover:bg-muted transition-colors" title="Add chapter">
                <Plus className="w-4 h-4 text-muted-foreground" />
              </button>
            ) : null}
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
                  {canEdit ? (
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
                  ) : null}
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
          <div className="max-w-3xl mx-auto my-3 md:my-8 px-2 md:px-0">
            <div className="bg-card rounded-xl md:rounded-2xl shadow-sm border border-border">
              <div className="sticky top-0 z-10 bg-card border-b border-border rounded-t-2xl px-4 py-2.5 flex items-center gap-1 flex-wrap">
                {toolbarGroups.map((group, gi) => (
                  <div key={gi} className="flex items-center gap-0.5">
                    {group.map((tool) => (
                      <button
                        key={tool.label}
                        onClick={() => handleToolAction(tool.label)}
                        disabled={!canEdit}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
                <>
                  <div className="px-4 md:px-16 pt-6 md:pt-10">
                    <input
                      value={chapterTitle}
                      onChange={(event) => setChapterTitle(event.target.value)}
                      onBlur={() => void handleSaveChapter()}
                      readOnly={!canEdit}
                      className="w-full text-2xl md:text-3xl font-bold bg-transparent text-foreground focus:outline-none"
                      placeholder="Chapter title"
                    />
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={editorHtml}
                    onChange={(event) => commitLocalContent(event.target.value)}
                    onBlur={() => void handleSaveChapter()}
                    readOnly={!canEdit}
                    className="w-full px-4 md:px-16 py-6 md:py-8 min-h-[54vh] bg-transparent text-foreground leading-relaxed focus:outline-none resize-none"
                    placeholder="Start writing..."
                  />
                </>
              ) : (
                <div className="px-4 md:px-16 py-12 min-h-[60vh] flex items-center justify-center text-muted-foreground">
                  No chapters yet. Create one to start writing.
                </div>
              )}
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        {(showDetails || showHistory) ? (
          <button
            aria-label="Close side panel"
            className="fixed inset-0 z-30 bg-black/35 md:hidden"
            onClick={() => {
              setShowDetails(false);
              setShowHistory(false);
            }}
          />
        ) : null}

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ x: 360 }}
              animate={{ x: 0 }}
              exit={{ x: 360 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-80 bg-card border-l border-border shadow-lg overflow-y-auto shrink-0 md:relative"
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
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadCover}
                  />
                  {isOwner ? (
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      disabled={isUploadingCover}
                      className="text-sm text-primary hover:underline disabled:opacity-60"
                    >
                      {isUploadingCover ? "Uploading cover..." : "Upload cover"}
                    </button>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Owner</label>
                  <p className="text-sm text-foreground/90">{book.owner.name}{isOwner ? " (you)" : ""}</p>
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
              initial={{ x: 360 }}
              animate={{ x: 0 }}
              exit={{ x: 360 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-80 bg-card border-l border-border shadow-lg overflow-y-auto shrink-0 md:relative"
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

      {showExport && <ExportModal onClose={() => setShowExport(false)} book={book} chapters={chapterEntries} />}
      {showShare && currentUser ? (
        <ShareBookModal
          book={book}
          currentUserId={currentUser.id}
          onClose={() => setShowShare(false)}
          onLeave={() => navigate("/dashboard")}
        />
      ) : null}
    </div>
  );
};

export default EditorPage;
