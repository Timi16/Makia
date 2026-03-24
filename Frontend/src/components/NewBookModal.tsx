import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload } from "lucide-react";
import { genres, coverSuggestions } from "@/lib/mockData";

interface NewBookModalProps {
  onClose: () => void;
}

const NewBookModal = ({ onClose }: NewBookModalProps) => {
  const [selectedCover, setSelectedCover] = useState<number | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("");

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
              <div className="grid grid-cols-3 gap-3">
                {coverSuggestions.map((cover, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedCover(i)}
                    className={`relative rounded-xl overflow-hidden h-32 transition-all duration-200 ${
                      selectedCover === i ? "ring-2 ring-primary ring-offset-2" : "hover:opacity-80"
                    }`}
                  >
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button className="flex items-center gap-2 mt-3 text-sm text-primary hover:underline">
                <Upload className="w-4 h-4" /> Upload custom cover
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Title</label>
              <input
                type="text"
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
                placeholder="What's your book about?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200 resize-none"
              />
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm hover:scale-[1.02] btn-press"
            >
              Create Book
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewBookModal;
