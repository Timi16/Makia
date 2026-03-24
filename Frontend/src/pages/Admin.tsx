import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, Users, BookOpen, Upload, Settings, ArrowLeft,
  TrendingUp, Search, Download, Edit, Ban, ChevronLeft, ChevronRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { adminUsers, mockBooks, mockUser } from "@/lib/mockData";

const navItems = [
  { icon: BarChart3, label: "Overview", id: "overview" },
  { icon: Users, label: "Users", id: "users" },
  { icon: BookOpen, label: "Books", id: "books" },
  { icon: Upload, label: "Exports", id: "exports" },
  { icon: Settings, label: "Settings", id: "settings" },
];

const barData = [
  { month: "Oct", books: 1240 },
  { month: "Nov", books: 1580 },
  { month: "Dec", books: 1320 },
  { month: "Jan", books: 1780 },
  { month: "Feb", books: 1640 },
  { month: "Mar", books: 2100 },
];

const pieData = [
  { name: "PDF", value: 58, color: "hsl(239, 84%, 67%)" },
  { name: "EPUB", value: 28, color: "hsl(270, 76%, 60%)" },
  { name: "MOBI", value: 14, color: "hsl(330, 70%, 60%)" },
];

const stats = [
  { label: "Total Users", value: "2,847", trend: "+12% this month", icon: Users },
  { label: "Total Books", value: "9,234", trend: "+8% this month", icon: BookOpen },
  { label: "Exports Today", value: "143", trend: "+23 today", icon: Upload },
  { label: "Revenue", value: "$12,480", trend: "+18% this month", icon: TrendingUp },
];

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-56 bg-sidebar flex flex-col shrink-0">
        <div className="p-5">
          <h1 className="text-lg font-bold text-sidebar-foreground">Folio AI Admin</h1>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 mb-3">
            <img src={mockUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-sm text-sidebar-foreground font-medium">{mockUser.name}</span>
          </div>
          <Link to="/dashboard" className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to App
          </Link>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <h2 className="text-2xl font-bold text-foreground">Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="folio-card p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-success">{s.trend}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 folio-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Books Created Per Month</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                    <Bar dataKey="books" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-2 folio-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Exports by Format</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" iconType="circle" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "users" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Users</h2>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input placeholder="Search users..." className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="folio-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Books</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Joined</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u, i) => (
                    <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          <span className="text-sm font-medium text-foreground">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{u.email}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{u.books}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{u.joined}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          u.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}>
                          {u.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Ban className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-center gap-1">
              <button className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4 text-muted-foreground" /></button>
              {[1, 2, 3, "...", 12].map((p, i) => (
                <button key={i} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === 1 ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                  {p}
                </button>
              ))}
              <button className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4 text-muted-foreground" /></button>
            </div>
          </motion.div>
        )}

        {activeTab === "books" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Books</h2>
            <div className="folio-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Title</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Author</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Chapters</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Exports</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {mockBooks.map((b, i) => (
                    <tr key={b.id} className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <img src={b.cover} alt="" className="w-8 h-11 rounded-md object-cover" />
                          <span className="text-sm font-medium text-foreground">{b.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">Alex Morgan</td>
                      <td className="px-5 py-3 text-sm text-foreground">{b.chapters}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{Math.floor(Math.random() * 20) + 1}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{b.lastEdited}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {(activeTab === "exports" || activeTab === "settings") && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">
              {activeTab === "exports" ? "Exports" : "Settings"} — Coming soon
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
