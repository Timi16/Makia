import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Eye, EyeOff, User, Star, Quote } from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import { register } from "@/lib/api";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";

const testimonials = [
  {
    quote: "Folio cut my publishing workflow in half. The export quality is incredible.",
    name: "Maria Chen",
    title: "Bestselling Author",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
    stars: 5,
  },
  {
    name: "David Park",
    title: "Indie Publisher",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
    stars: 5,
  },
  {
    name: "Lena Rossi",
    title: "Content Writer",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
    stars: 5,
  },
  {
    name: "Tom Hughes",
    title: "Fiction Author",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
    stars: 4,
  },
];

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const strength = useMemo(() => {
    if (password.length === 0) return { level: 0, label: "", color: "" };
    if (password.length < 8) return { level: 1, label: "Weak", color: "bg-destructive" };
    if (password.length < 12) return { level: 2, label: "Medium", color: "bg-warning" };
    return { level: 3, label: "Strong", color: "bg-success" };
  }, [password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!agreedTerms) {
      setError("You must accept the terms");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const leftContent = (
    <div className="flex flex-col h-full justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Quote className="w-10 h-10 text-primary-foreground/40 mb-6" />
        <p className="text-2xl lg:text-3xl font-medium text-primary-foreground leading-relaxed mb-8">
          "{testimonials[0].quote}"
        </p>
        <div className="flex items-center gap-3 mb-12">
          <img
            src={testimonials[0].avatar}
            alt={testimonials[0].name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-primary-foreground/20"
          />
          <div>
            <p className="text-primary-foreground font-semibold">{testimonials[0].name}</p>
            <p className="text-primary-foreground/60 text-sm">{testimonials[0].title}</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="grid grid-cols-3 gap-3"
      >
        {testimonials.slice(1).map((t, i) => (
          <div key={i} className="bg-primary-foreground/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <img src={t.avatar} alt={t.name} className="w-8 h-8 rounded-full object-cover" />
              <div>
                <p className="text-primary-foreground text-xs font-medium">{t.name}</p>
                <p className="text-primary-foreground/50 text-[10px]">{t.title}</p>
              </div>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: t.stars }).map((_, j) => (
                <Star key={j} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );

  const rightContent = (
    <div className="flex-1 flex flex-col px-8 sm:px-16 lg:px-20 py-12">
      <Link to="/" className="text-2xl font-bold text-primary mb-12 inline-flex items-center gap-2">
        <img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="w-6 h-6" />
        {BRAND_NAME}
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full"
      >
        <h2 className="text-2xl font-bold text-foreground mb-1">Start writing today</h2>
        <p className="text-muted-foreground mb-8">Free forever. No credit card.</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
              required
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
              required
            />
          </div>

          <div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        i <= strength.level ? strength.color : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{strength.label}</span>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
              required
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-input text-primary focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">
              I agree to the <button type="button" className="text-primary hover:underline">Terms</button> &{" "}
              <button type="button" className="text-primary hover:underline">Privacy Policy</button>
            </span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm hover:scale-[1.02] btn-press flex items-center justify-center disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create my account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );

  return <AuthLayout leftContent={leftContent} rightContent={rightContent} />;
};

export default RegisterPage;
