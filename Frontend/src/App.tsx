import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ensureSession, getAccessToken, getCurrentUser, type AuthUser } from "@/lib/api";

import LandingPage from "./pages/Landing";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import DashboardPage from "./pages/Dashboard";
import EditorPage from "./pages/Editor";
import AdminPage from "./pages/Admin";
import AdminLoginPage from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";

const RequireUserAuth = ({ children, user }: { children: JSX.Element; user: AuthUser | null }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

const RequireAdminAuth = ({ children, user }: { children: JSX.Element; user: AuthUser | null }) => {
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const RedirectIfUserAuthed = ({ children, user }: { children: JSX.Element; user: AuthUser | null }) => {
  if (user) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  return children;
};

const RedirectIfAdminAuthed = ({ children, user }: { children: JSX.Element; user: AuthUser | null }) => {
  if (!user) {
    return children;
  }

  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const App = () => {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getCurrentUser());

  useEffect(() => {
    let active = true;

    const bootstrapAuth = async () => {
      const hasToken = Boolean(getAccessToken());
      const cachedUser = getCurrentUser();

      try {
        if (hasToken && cachedUser && active) {
          setCurrentUser(cachedUser);
        }

        await ensureSession();
        if (active) {
          setCurrentUser(getCurrentUser());
        }
      } catch (error) {
        if (active) {
          const unauthorized =
            error instanceof Error && error.message.toLowerCase().includes("unauthorized");
          setCurrentUser(unauthorized ? null : cachedUser);
        }
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncAuth = () => {
      setCurrentUser(getCurrentUser());
    };

    window.addEventListener("auth-changed", syncAuth);
    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("auth-changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<RedirectIfUserAuthed user={currentUser}><LoginPage /></RedirectIfUserAuthed>} />
            <Route path="/register" element={<RedirectIfUserAuthed user={currentUser}><RegisterPage /></RedirectIfUserAuthed>} />
            <Route path="/dashboard" element={<RequireUserAuth user={currentUser}><DashboardPage /></RequireUserAuth>} />
            <Route path="/editor/:bookId" element={<RequireUserAuth user={currentUser}><EditorPage /></RequireUserAuth>} />
            <Route path="/admin/login" element={<RedirectIfAdminAuthed user={currentUser}><AdminLoginPage /></RedirectIfAdminAuthed>} />
            <Route path="/admin/*" element={<RequireAdminAuth user={currentUser}><AdminPage /></RequireAdminAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </>
  );
};

export default App;
