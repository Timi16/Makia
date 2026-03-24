import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, GripVertical, X, Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Image, Table,
  Undo, Redo, Clock, SlidersHorizontal, Download, ChevronDown
} from "lucide-react";
import { mockBooks, mockChapters, collaborators } from "@/lib/mockData";
import ExportModal from "@/components/ExportModal";

const editorContent = `<h1 class="text-3xl font-bold mb-6 text-foreground">Chapter 1 — The Beginning</h1>
<p class="text-lg leading-relaxed text-foreground/90 mb-4">The terminal blinked twice before the message appeared. Dr. Elena Vasquez leaned closer to the screen, her coffee growing cold beside her keyboard. The algorithm had been running for seventy-two hours straight, processing more data than any previous iteration.</p>
<p class="text-lg leading-relaxed text-foreground/90 mb-4">"That's not possible," she whispered, scrolling through the output. The numbers didn't just suggest a breakthrough — they demanded one. Every model she'd built over the past three years pointed to this moment, but nothing could have prepared her for what she was seeing now.</p>
<p class="text-lg leading-relaxed text-foreground/90 mb-4">Outside the lab window, the campus was quiet. It was nearly 3 AM, and the only light besides her own came from the security office across the courtyard. She pulled up the visualization module and watched as the data arranged itself into patterns she'd only theorized about in her doctoral thesis.</p>`;

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

const EditorPage = () => {
  const [activeChapter, setActiveChapter] = useState("c1");
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>(["Bold"]);
  const book = mockBooks[0];
  const totalWords = mockChapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  const toggleTool = (label: string) => {
    setActiveTools((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-card border-b border-border flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-medium text-foreground text-sm">{book.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Saved just now
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
        {/* Left Sidebar */}
        <div className="w-64 bg-card border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <Link to="/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors inline-flex text-muted-foreground mb-3">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <img src={book.cover} alt="" className="w-10 h-14 rounded-lg object-cover" />
              <h3 className="font-semibold text-sm text-foreground leading-tight">{book.title}</h3>
            </div>
          </div>

          <div className="p-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chapters</span>
            <button className="p-1 rounded-md hover:bg-muted transition-colors">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {mockChapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChapter(ch.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group flex items-center gap-2 ${
                  activeChapter === ch.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <GripVertical className={`w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0 ${activeChapter === ch.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Ch. {ch.number} — {ch.title}</p>
                  <p className={`text-xs ${activeChapter === ch.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {ch.wordCount.toLocaleString()} words
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-border space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalWords.toLocaleString()} words</span>
              <span>~{Math.ceil(totalWords / 250)} min read</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="14" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="3"
                  strokeDasharray={`${65 * 0.88} ${100 * 0.88}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs text-muted-foreground">65% complete</span>
            </div>
          </div>
        </div>

        {/* Main Editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto my-8">
            <div className="bg-card rounded-2xl shadow-sm border border-border">
              {/* Toolbar */}
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

              {/* Canvas */}
              <div
                className="px-16 py-12 min-h-[60vh] prose prose-lg max-w-none focus:outline-none"
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: editorContent }}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Details */}
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
                  <img src={book.cover} alt="" className="w-full h-48 object-cover rounded-xl mb-2" />
                  <button className="text-sm text-primary hover:underline">Change Cover</button>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
                  <textarea rows={3} className="w-full px-3 py-2 rounded-xl border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Describe your book..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Genre</label>
                  <select className="w-full px-3 py-2 rounded-xl border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option>Sci-Fi</option>
                    <option>Fantasy</option>
                    <option>Thriller</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Stats</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Total Words", value: "5,600" },
                      { label: "Chapters", value: "5" },
                      { label: "Est. Pages", value: "22" },
                      { label: "Last Export", value: "3d ago" },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-semibold text-foreground">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:scale-[1.02] btn-press">
                  Save Details
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Panel - History */}
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
              <div className="p-4">
                {[
                  { type: "Auto-saved", time: "Today at 2:34 PM", diff: "+124 words" },
                  { type: "Auto-saved", time: "Today at 1:15 PM", diff: "+89 words" },
                  { type: "Manual save", time: "Today at 11:00 AM", diff: "+256 words" },
                  { type: "Auto-saved", time: "Yesterday at 4:22 PM", diff: "+45 words" },
                  { type: "Manual save", time: "Yesterday at 2:00 PM", diff: "+312 words" },
                ].map((v, i) => (
                  <div key={i} className="flex gap-3 group">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary mt-1 shrink-0" />
                      {i < 4 && <div className="w-0.5 flex-1 bg-border" />}
                    </div>
                    <div className="pb-6 flex-1">
                      <p className="text-sm font-medium text-foreground">{v.type}</p>
                      <p className="text-xs text-muted-foreground">{v.time}</p>
                      <p className="text-xs text-success mt-0.5">{v.diff}</p>
                      <button className="text-xs text-primary hover:underline mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Restore this version
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  );
};

export default EditorPage;
