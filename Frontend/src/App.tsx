import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAccessToken } from "@/lib/api";

import LandingPage from "./pages/Landing";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import DashboardPage from "./pages/Dashboard";
import EditorPage from "./pages/Editor";
import AdminPage from "./pages/Admin";
import NotFound from "./pages/NotFound";

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const RedirectIfAuthed = ({ children }: { children: JSX.Element }) => {
  if (getAccessToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => (
  <>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/editor/:bookId" element={<RequireAuth><EditorPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </>
);

export default App;
