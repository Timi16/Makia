import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ensureSession, getAccessToken } from "@/lib/api";

import LandingPage from "./pages/Landing";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import DashboardPage from "./pages/Dashboard";
import EditorPage from "./pages/Editor";
import AdminPage from "./pages/Admin";
import NotFound from "./pages/NotFound";

const RequireAuth = ({ children, authed }: { children: JSX.Element; authed: boolean }) => {
  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const RedirectIfAuthed = ({ children, authed }: { children: JSX.Element; authed: boolean }) => {
  if (authed) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => {
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(Boolean(getAccessToken()));

  useEffect(() => {
    let active = true;

    const bootstrapAuth = async () => {
      if (getAccessToken()) {
        if (active) {
          setAuthed(true);
          setAuthReady(true);
        }
        return;
      }

      try {
        await ensureSession();
        if (active) {
          setAuthed(true);
        }
      } catch {
        if (active) {
          setAuthed(false);
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
      setAuthed(Boolean(getAccessToken()));
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
            <Route path="/login" element={<RedirectIfAuthed authed={authed}><LoginPage /></RedirectIfAuthed>} />
            <Route path="/register" element={<RedirectIfAuthed authed={authed}><RegisterPage /></RedirectIfAuthed>} />
            <Route path="/dashboard" element={<RequireAuth authed={authed}><DashboardPage /></RequireAuth>} />
            <Route path="/editor/:bookId" element={<RequireAuth authed={authed}><EditorPage /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth authed={authed}><AdminPage /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </>
  );
};

export default App;
