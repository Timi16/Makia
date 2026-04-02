import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, MoreVertical, Loader2 } from "lucide-react";

import DashboardNavbar from "@/components/DashboardNavbar";
import NewBookModal from "@/components/NewBookModal";
import {
  createBook,
  deleteBook,
  getBooks,
  getChapters,
  getCurrentUser,
  uploadBookCover,
  type ApiBook,
  type AuthUser,
} from "@/lib/api";

type BookStatus = "idle" | "processing" | "done" | "failed";

interface UIBook {
  id: string;
  title: string;
  cover: string;
  genre: string;
  genreColor: string;
  chapters: number;
  totalChapters: number;
  status: BookStatus;
  lastEdited: string;
}

const statusConfig: Record<BookStatus, { label: string; className: string; spinner?: boolean }> = {
  idle: { label: "Idle", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-700", spinner: true },
  done: { label: "Published", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

const genreStyles = [
  "bg-cyan-100 text-cyan-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function mapBook(book: ApiBook, index: number, chapterCount: number): UIBook {
  return {
    id: book.id,
    title: book.title,
    cover: book.coverUrl || "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&h=400&fit=crop",
    genre: book.genre || "General",
    genreColor: genreStyles[index % genreStyles.length],
    chapters: chapterCount,
    totalChapters: Math.max(chapterCount, 1),
    status: "idle",
    lastEdited: formatRelativeDate(book.updatedAt),
  };
}

const BookCard = ({
  book,
  onDelete,
}: {
  book: UIBook;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const status = statusConfig[book.status];
  const progress = Math.round((book.chapters / book.totalChapters) * 100);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(book.id);
      setMenuOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="folio-card overflow-hidden hover-lift group"
    >
      <Link to={`/editor/${book.id}`} className="block">
        <div className="relative h-48 overflow-hidden">
          <img
            src={book.cover}
            alt={book.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className={`absolute bottom-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full ${book.genreColor}`}>
            {book.genre}
          </span>
        </div>
      </Link>

      <div className="p-4">
        <Link to={`/editor/${book.id}`}>
          <h3 className="font-semibold text-foreground mb-1 hover:text-primary transition-colors">{book.title}</h3>
        </Link>
        <p className="text-sm text-muted-foreground mb-3">
          {book.chapters} chapters · Last edited {book.lastEdited}
        </p>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{progress}% complete</p>
      </div>

      <div className="border-t border-border px-4 py-3 flex items-center justify-between">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${status.className}`}>
          {status.spinner && <Loader2 className="w-3 h-3 animate-spin" />}
          {status.label}
        </span>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-1 w-40 bg-card rounded-xl border border-border shadow-lg py-1 animate-scale-in z-10">
              <Link to={`/editor/${book.id}`} className="block px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">Open Editor</Link>
              <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">Export Book</button>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const DashboardPage = () => {
  const [showNewBook, setShowNewBook] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser());
  const [books, setBooks] = useState<UIBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const apiBooks = await getBooks();
        const chapterCounts = await Promise.all(
          apiBooks.map(async (book) => {
            const chapters = await getChapters(book.id);
            return chapters.length;
          })
        );

        if (!active) {
          return;
        }

        setBooks(apiBooks.map((book, index) => mapBook(book, index, chapterCounts[index])));
        setUser(getCurrentUser());
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load books";
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
  }, [navigate]);

  const handleCreateBook = async (input: {
    title: string;
    description?: string;
    genre?: string;
    coverUrl?: string;
    coverFile?: File;
  }) => {
    const { coverFile, ...createInput } = input;
    const created = await createBook(createInput);
    let finalBook = created;

    if (coverFile) {
      const uploadedCoverUrl = await uploadBookCover(created.id, coverFile);
      finalBook = { ...created, coverUrl: uploadedCoverUrl };
    }

    const createdUI = mapBook(finalBook, 0, 0);
    setBooks((prev) => [createdUI, ...prev]);
  };

  const handleDeleteBook = async (id: string) => {
    await deleteBook(id);
    setBooks((prev) => prev.filter((book) => book.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar user={user} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="folio-gradient rounded-2xl p-8 mb-10 relative overflow-hidden"
        >
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-bold text-primary-foreground mb-2">
              Good morning, {user?.name.split(" ")[0] || "Writer"} 👋
            </h1>
            <p className="text-primary-foreground/70 mb-5">You have {books.length} books in your workspace</p>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1455390582262-044cdead277a?w=260&h=180&fit=crop"
              alt="Writing desk"
              className="rounded-xl opacity-30"
            />
          </div>
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary-foreground/5" />
        </motion.div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">My Books</h2>
          <button
            onClick={() => setShowNewBook(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:scale-[1.02] btn-press"
          >
            <Plus className="w-4 h-4" /> New Book
          </button>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading books...</p> : null}
        {error ? <p className="text-sm text-destructive mb-4">{error}</p> : null}

        {!loading && books.length === 0 ? (
          <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
            No books yet. Create your first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onDelete={handleDeleteBook} />
            ))}
          </div>
        )}
      </main>

      {showNewBook && <NewBookModal onClose={() => setShowNewBook(false)} onCreate={handleCreateBook} />}
    </div>
  );
};

export default DashboardPage;
