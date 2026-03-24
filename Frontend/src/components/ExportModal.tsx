import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, FileText, BookOpen, Smartphone } from "lucide-react";

type Format = "pdf" | "epub" | "mobi";
type ExportStage = "select" | "progress" | "done";

const formats: { id: Format; icon: typeof FileText; name: string; desc: string }[] = [
  { id: "pdf", icon: FileText, name: "PDF", desc: "Best for printing & sharing" },
  { id: "epub", icon: BookOpen, name: "EPUB", desc: "Perfect for e-readers" },
  { id: "mobi", icon: Smartphone, name: "MOBI", desc: "Optimized for Kindle" },
];

const steps = ["Preparing content", "Generating file", "Uploading", "Ready to download"];

const ExportModal = ({ onClose }: { onClose: () => void }) => {
  const [selected, setSelected] = useState<Format>("pdf");
  const [stage, setStage] = useState<ExportStage>("select");
  const [currentStep, setCurrentStep] = useState(0);
  const [includeCover, setIncludeCover] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);

  useEffect(() => {
    if (stage === "progress") {
      const timers = steps.map((_, i) =>
        setTimeout(() => {
          setCurrentStep(i + 1);
          if (i === steps.length - 1) setStage("done");
        }, (i + 1) * 1200)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [stage]);

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
                  <select className="w-full px-3 py-2 rounded-xl border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option>A4</option>
                    <option>Letter</option>
                    <option>A5</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => { setStage("progress"); setCurrentStep(0); }}
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
                  transition={{ delay: i * 0.15 }}
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
                <p className="text-sm text-muted-foreground">2.4 MB</p>
              </div>
              <button className="w-full py-3 rounded-xl bg-success text-success-foreground font-medium shadow-sm hover:scale-[1.02] btn-press">
                Download {selected.toUpperCase()}
              </button>
              <button onClick={() => setStage("select")} className="text-sm text-primary hover:underline">
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
