import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react";

import {
  getAdminBooks,
  getAdminOverview,
  getAdminUsers,
  getCurrentUser,
  logout,
  type AdminBooksResponse,
  type AdminOverview,
  type AdminUsersResponse,
  type AuthUser,
} from "@/lib/api";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";

const navItems = [
  { icon: BarChart3, label: "Overview", path: "/admin" },
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: BookOpen, label: "Books", path: "/admin/books" },
  { icon: Upload, label: "Exports", path: "/admin/exports" },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
] as const;

const pageSize = 12;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getActiveTab(pathname: string): "overview" | "users" | "books" | "exports" | "settings" {
  const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  if (normalizedPath === "/admin/users") {
    return "users";
  }
  if (normalizedPath === "/admin/books") {
    return "books";
  }
  if (normalizedPath === "/admin/exports") {
    return "exports";
  }
  if (normalizedPath === "/admin/settings") {
    return "settings";
  }
  return "overview";
}

const AdminPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState<AuthUser | null>(getCurrentUser());

  const activeTab = useMemo(() => getActiveTab(location.pathname), [location.pathname]);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [usersState, setUsersState] = useState<AdminUsersResponse | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersSearchInput, setUsersSearchInput] = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  const [usersPage, setUsersPage] = useState(1);

  const [booksState, setBooksState] = useState<AdminBooksResponse | null>(null);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [booksSearchInput, setBooksSearchInput] = useState("");
  const [booksSearch, setBooksSearch] = useState("");
  const [booksPage, setBooksPage] = useState(1);

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setOverviewLoading(true);
      setOverviewError(null);

      try {
        const data = await getAdminOverview();
        if (!active) {
          return;
        }
        setOverview(data);
      } catch (error) {
        if (!active) {
          return;
        }
        setOverviewError(error instanceof Error ? error.message : "Failed to load admin overview");
      } finally {
        if (active) {
          setOverviewLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setAdminUser(getCurrentUser());
  }, [location.pathname]);

  useEffect(() => {
    if (activeTab !== "users") {
      return;
    }

    let active = true;

    const run = async () => {
      setUsersLoading(true);
      setUsersError(null);

      try {
        const data = await getAdminUsers({
          page: usersPage,
          pageSize,
          search: usersSearch,
        });

        if (!active) {
          return;
        }
        setUsersState(data);
      } catch (error) {
        if (!active) {
          return;
        }
        setUsersError(error instanceof Error ? error.message : "Failed to load users");
      } finally {
        if (active) {
          setUsersLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [activeTab, usersPage, usersSearch]);

  useEffect(() => {
    if (activeTab !== "books") {
      return;
    }

    let active = true;

    const run = async () => {
      setBooksLoading(true);
      setBooksError(null);

      try {
        const data = await getAdminBooks({
          page: booksPage,
          pageSize,
          search: booksSearch,
        });

        if (!active) {
          return;
        }
        setBooksState(data);
      } catch (error) {
        if (!active) {
          return;
        }
        setBooksError(error instanceof Error ? error.message : "Failed to load books");
      } finally {
        if (active) {
          setBooksLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [activeTab, booksPage, booksSearch]);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await logout();
      navigate("/admin/login");
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = adminUser?.name
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar">
        <div className="p-5">
          <Link to="/admin" className="inline-flex items-center gap-2 text-lg font-bold text-sidebar-foreground">
            <img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="h-5 w-5" />
            {BRAND_NAME} Admin
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const tabId = item.path.split("/").pop() || "overview";
            const tabActive = tabId === activeTab || (item.path === "/admin" && activeTab === "overview");

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  tabActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-foreground">
              {initials || "A"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{adminUser?.name ?? "Admin"}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{adminUser?.email ?? "-"}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-60"
          >
            <LogOut className="h-3 w-3" />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to app
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === "overview" ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>

            {overviewLoading ? (
              <p className="text-sm text-muted-foreground">Loading overview...</p>
            ) : null}
            {overviewError ? <p className="text-sm text-destructive">{overviewError}</p> : null}

            {overview ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="folio-card p-5">
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{overview.totalUsers}</p>
                </div>
                <div className="folio-card p-5">
                  <p className="text-sm text-muted-foreground">Active (30d)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{overview.activeUsersLast30Days}</p>
                </div>
                <div className="folio-card p-5">
                  <p className="text-sm text-muted-foreground">New Users (30d)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{overview.newUsersLast30Days}</p>
                </div>
                <div className="folio-card p-5">
                  <p className="text-sm text-muted-foreground">Total Books</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{overview.totalBooks}</p>
                </div>
                <div className="folio-card p-5">
                  <p className="text-sm text-muted-foreground">Total Exports</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{overview.totalExports}</p>
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {activeTab === "users" ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Users</h1>
            </div>

            <form
              className="relative max-w-sm"
              onSubmit={(event) => {
                event.preventDefault();
                setUsersPage(1);
                setUsersSearch(usersSearchInput.trim());
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={usersSearchInput}
                onChange={(event) => setUsersSearchInput(event.target.value)}
                placeholder="Search users..."
                className="w-full rounded-xl border border-input bg-card py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </form>

            {usersLoading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
            {usersError ? <p className="text-sm text-destructive">{usersError}</p> : null}

            <div className="folio-card overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Books</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exports</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersState?.items ?? []).map((user, index) => (
                    <tr key={user.id} className={`border-b border-border last:border-0 ${index % 2 ? "bg-muted/30" : ""}`}>
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{user.name}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{user.email}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{user.role}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{user.booksCount}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{user.exportsCount}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(user.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {user.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setUsersPage((page) => Math.max(1, page - 1))}
                disabled={usersLoading || usersPage <= 1}
                className="rounded-lg border border-border p-2 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-sm text-muted-foreground">
                Page {usersState?.pagination.page ?? usersPage} of {usersState?.pagination.totalPages ?? 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setUsersPage((page) => {
                    const totalPages = usersState?.pagination.totalPages ?? 1;
                    return Math.min(totalPages, page + 1);
                  })
                }
                disabled={usersLoading || usersPage >= (usersState?.pagination.totalPages ?? 1)}
                className="rounded-lg border border-border p-2 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        ) : null}

        {activeTab === "books" ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h1 className="text-2xl font-bold text-foreground">Books</h1>

            <form
              className="relative max-w-sm"
              onSubmit={(event) => {
                event.preventDefault();
                setBooksPage(1);
                setBooksSearch(booksSearchInput.trim());
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={booksSearchInput}
                onChange={(event) => setBooksSearchInput(event.target.value)}
                placeholder="Search books or owner..."
                className="w-full rounded-xl border border-input bg-card py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </form>

            {booksLoading ? <p className="text-sm text-muted-foreground">Loading books...</p> : null}
            {booksError ? <p className="text-sm text-destructive">{booksError}</p> : null}

            <div className="folio-card overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapters</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exports</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {(booksState?.items ?? []).map((book, index) => (
                    <tr key={book.id} className={`border-b border-border last:border-0 ${index % 2 ? "bg-muted/30" : ""}`}>
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{book.title}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        <div>{book.owner.name}</div>
                        <div className="text-xs">{book.owner.email}</div>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">{book.chaptersCount}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{book.exportsCount}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(book.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setBooksPage((page) => Math.max(1, page - 1))}
                disabled={booksLoading || booksPage <= 1}
                className="rounded-lg border border-border p-2 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-sm text-muted-foreground">
                Page {booksState?.pagination.page ?? booksPage} of {booksState?.pagination.totalPages ?? 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setBooksPage((page) => {
                    const totalPages = booksState?.pagination.totalPages ?? 1;
                    return Math.min(totalPages, page + 1);
                  })
                }
                disabled={booksLoading || booksPage >= (booksState?.pagination.totalPages ?? 1)}
                className="rounded-lg border border-border p-2 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        ) : null}

        {activeTab === "exports" || activeTab === "settings" ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">
              {activeTab === "exports" ? "Exports" : "Settings"} panel coming next.
            </p>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
};

export default AdminPage;
