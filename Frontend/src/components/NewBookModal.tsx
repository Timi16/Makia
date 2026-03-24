import { type ChangeEvent, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload } from "lucide-react";
import { genres, coverSuggestions } from "@/lib/mockData";

interface NewBookModalProps {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description?: string;
    genre?: string;
    coverUrl?: string;
    coverFile?: File;
  }) => Promise<void>;
}

const NewBookModal = ({ onClose, onCreate }: NewBookModalProps) => {
  const [selectedCover, setSelectedCover] = useState<number | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCover = useMemo(() => {
    if (coverPreviewUrl) {
      return coverPreviewUrl;
    }

    if (selectedCover !== null) {
      return coverSuggestions[selectedCover];
    }

    return null;
  }, [coverPreviewUrl, selectedCover]);

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }

    setError(null);
    setCoverFile(file);
    setSelectedCover(null);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        genre: selectedGenre || undefined,
        coverUrl: selectedCover !== null ? coverSuggestions[selectedCover] : undefined,
        coverFile: coverFile ?? undefined,
      });
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
      onClose();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create book");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
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
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Create a new book</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Choose a cover</label>
              {activeCover ? (
                <div className="mb-3 rounded-xl overflow-hidden border border-border">
                  <img src={activeCover} alt="Selected cover" className="w-full h-40 object-cover" />
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-3">
                {coverSuggestions.map((cover, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedCover(i);
                      setCoverFile(null);
                      if (coverPreviewUrl) {
                        URL.revokeObjectURL(coverPreviewUrl);
                        setCoverPreviewUrl(null);
                      }
                    }}
                    className={`relative rounded-xl overflow-hidden h-32 transition-all duration-200 ${
                      selectedCover === i ? "ring-2 ring-primary ring-offset-2" : "hover:opacity-80"
                    }`}
                  >
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-3 text-sm text-primary hover:underline cursor-pointer">
                <Upload className="w-4 h-4" /> {coverFile ? "Change custom cover" : "Upload custom cover"}
                <input type="file" accept="image/*" className="hidden" onChange={handleSelectFile} />
              </label>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter your book title"
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Genre</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
              >
                <option value="">Select a genre</option>
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's your book about?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200 resize-none"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <button
              onClick={handleCreate}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm hover:scale-[1.02] btn-press disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Book"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewBookModal;
