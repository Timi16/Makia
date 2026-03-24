import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, MoreVertical, Loader2 } from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import NewBookModal from "@/components/NewBookModal";
import { mockBooks, mockUser, type Book, type BookStatus } from "@/lib/mockData";

const statusConfig: Record<BookStatus, { label: string; className: string; spinner?: boolean }> = {
  idle: { label: "Idle", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-700", spinner: true },
  done: { label: "Published", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

const BookCard = ({ book }: { book: Book }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = statusConfig[book.status];
  const progress = Math.round((book.chapters / book.totalChapters) * 100);

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
              <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">Duplicate</button>
              <div className="border-t border-border my-1" />
              <button className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors">Delete</button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const DashboardPage = () => {
  const [showNewBook, setShowNewBook] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="folio-gradient rounded-2xl p-8 mb-10 relative overflow-hidden"
        >
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-bold text-primary-foreground mb-2">
              Good morning, {mockUser.name.split(" ")[0]} 👋
            </h1>
            <p className="text-primary-foreground/70 mb-5">You have 3 books in progress</p>
            <div className="flex gap-3">
              <span className="bg-primary-foreground/15 text-primary-foreground text-sm px-4 py-1.5 rounded-full backdrop-blur-sm">
                12 chapters written
              </span>
              <span className="bg-primary-foreground/15 text-primary-foreground text-sm px-4 py-1.5 rounded-full backdrop-blur-sm">
                4 exports this month
              </span>
            </div>
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

        {/* Books Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">My Books</h2>
          <button
            onClick={() => setShowNewBook(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:scale-[1.02] btn-press"
          >
            <Plus className="w-4 h-4" /> New Book
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockBooks.map((book, i) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </main>

      {showNewBook && <NewBookModal onClose={() => setShowNewBook(false)} />}
    </div>
  );
};

export default DashboardPage;
