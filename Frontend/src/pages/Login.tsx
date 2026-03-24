import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Eye, EyeOff, BookOpen, FileText, Users, Sparkles } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const bookCovers = [
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=400&fit=crop",
  "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&h=400&fit=crop",
];

const features = [
  { icon: BookOpen, text: "Rich text editor built for authors" },
  { icon: FileText, text: "Export to PDF, EPUB and MOBI instantly" },
  { icon: Users, text: "Collaborate in real time with your team" },
];

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);

  const leftContent = (
    <div className="flex flex-col h-full justify-between">
      <div className="flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary-foreground/80" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-primary-foreground leading-tight mb-4">
            Write your story.<br />Share it with the world.
          </h1>
          <p className="text-lg text-primary-foreground/70 mb-10">
            The professional tool for modern authors.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-4 mb-12"
        >
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <f.icon className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-primary-foreground/90">{f.text}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="flex gap-4 items-end"
      >
        {bookCovers.map((cover, i) => (
          <div
            key={i}
            className="w-28 h-40 rounded-xl overflow-hidden shadow-2xl"
            style={{ transform: `rotate(${(i - 1) * 3}deg)` }}
          >
            <img src={cover} alt="Book cover" className="w-full h-full object-cover" />
          </div>
        ))}
      </motion.div>
    </div>
  );

  const rightContent = (
    <div className="flex-1 flex flex-col px-8 sm:px-16 lg:px-20 py-12">
      <Link to="/" className="text-2xl font-bold text-primary mb-16">
        Folio
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full"
      >
        <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back</h2>
        <p className="text-muted-foreground mb-8">Sign in to your account</p>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email address"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
            />
          </div>

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
              className="w-full pl-10 pr-12 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex justify-end">
            <button className="text-sm text-primary hover:underline">Forgot password?</button>
          </div>

          <Link
            to="/dashboard"
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm hover:scale-[1.02] btn-press flex items-center justify-center"
          >
            Sign in
          </Link>
        </form>

        <div className="flex items-center gap-3 my-8">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create one free
          </Link>
        </p>
      </motion.div>
    </div>
  );

  return <AuthLayout leftContent={leftContent} rightContent={rightContent} />;
};

export default LoginPage;
