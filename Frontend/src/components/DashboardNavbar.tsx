import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, ChevronDown, User, CreditCard, LogOut } from "lucide-react";

import { type AuthUser, logout } from "@/lib/api";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";

interface DashboardNavbarProps {
  user: AuthUser | null;
}

const DashboardNavbar = ({ user }: DashboardNavbarProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await logout();
      navigate("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = user?.name
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <nav className="sticky top-0 z-50 bg-card border-b border-border h-16 flex items-center px-6">
      <Link to="/" className="text-xl font-bold text-primary mr-8 inline-flex items-center gap-2">
        <img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="w-5 h-5" />
        {BRAND_NAME}
      </Link>

      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search your books..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 ml-8">
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
              {initials || "U"}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl border border-border shadow-lg py-2 animate-scale-in">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-foreground">{user?.name ?? "Unknown user"}</p>
                <p className="text-xs text-muted-foreground">{user?.email ?? "No email"}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                <User className="w-4 h-4" /> Profile Settings
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                <CreditCard className="w-4 h-4" /> Billing
              </button>
              <div className="border-t border-border my-1" />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" /> {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default DashboardNavbar;
