import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import { adminLogin } from "@/lib/api";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";

const AdminLoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const user = await adminLogin(email, password);
      if (user.role !== "ADMIN") {
        throw new Error("Admin access required");
      }

      navigate("/admin");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  const leftContent = (
    <div className="flex h-full flex-col justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 text-sm text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
          Admin Control Center
        </div>
        <h1 className="mb-4 text-4xl font-bold leading-tight text-primary-foreground">
          Secure admin access
        </h1>
        <p className="max-w-md text-primary-foreground/75">
          Manage users, books, and platform activity with real-time operational data.
        </p>
      </motion.div>
    </div>
  );

  const rightContent = (
    <div className="flex flex-1 flex-col px-8 py-12 sm:px-16 lg:px-20">
      <Link to="/" className="mb-16 inline-flex items-center gap-2 text-2xl font-bold text-primary">
        <img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="h-6 w-6" />
        {BRAND_NAME}
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center"
      >
        <h2 className="mb-1 text-2xl font-bold text-foreground">Admin sign in</h2>
        <p className="mb-8 text-muted-foreground">Use your admin credentials to continue</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Admin email"
              className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="relative">
            <div className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-primary py-3 font-medium text-primary-foreground shadow-sm disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in as admin"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Not an admin?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Go to user login
          </Link>
        </p>
      </motion.div>
    </div>
  );

  return <AuthLayout leftContent={leftContent} rightContent={rightContent} />;
};

export default AdminLoginPage;
