export const mockUser = {
  name: "Alex Morgan",
  email: "alex@folio.app",
  avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
  role: "admin" as const,
};

export const collaborators = [
  {
    name: "Sarah K.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "James O.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
  },
];

export type BookStatus = "idle" | "processing" | "done" | "failed";

export interface Book {
  id: string;
  title: string;
  genre: string;
  cover: string;
  chapters: number;
  totalChapters: number;
  lastEdited: string;
  status: BookStatus;
  genreColor: string;
}

export const mockBooks: Book[] = [
  {
    id: "1",
    title: "The Last Algorithm",
    genre: "Sci-Fi",
    cover: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=500&fit=crop",
    chapters: 5,
    totalChapters: 12,
    lastEdited: "2h ago",
    status: "idle",
    genreColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "2",
    title: "Quiet Storms",
    genre: "Literary Fiction",
    cover: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=400&h=500&fit=crop",
    chapters: 8,
    totalChapters: 10,
    lastEdited: "1d ago",
    status: "done",
    genreColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "3",
    title: "Build to Last",
    genre: "Business",
    cover: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=500&fit=crop",
    chapters: 3,
    totalChapters: 8,
    lastEdited: "3d ago",
    status: "processing",
    genreColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "4",
    title: "Ocean of Stars",
    genre: "Fantasy",
    cover: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=500&fit=crop",
    chapters: 6,
    totalChapters: 15,
    lastEdited: "5h ago",
    status: "idle",
    genreColor: "bg-purple-100 text-purple-700",
  },
  {
    id: "5",
    title: "The Founder's Dilemma",
    genre: "Startup",
    cover: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=500&fit=crop",
    chapters: 10,
    totalChapters: 10,
    lastEdited: "1w ago",
    status: "done",
    genreColor: "bg-rose-100 text-rose-700",
  },
  {
    id: "6",
    title: "Midnight Protocol",
    genre: "Thriller",
    cover: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=400&h=500&fit=crop",
    chapters: 2,
    totalChapters: 14,
    lastEdited: "12h ago",
    status: "failed",
    genreColor: "bg-slate-100 text-slate-700",
  },
];

export interface Chapter {
  id: string;
  number: number;
  title: string;
  wordCount: number;
}

export const mockChapters: Chapter[] = [
  { id: "c1", number: 1, title: "The Beginning", wordCount: 1240 },
  { id: "c2", number: 2, title: "First Contact", wordCount: 980 },
  { id: "c3", number: 3, title: "The Signal", wordCount: 1560 },
  { id: "c4", number: 4, title: "Dark Matter", wordCount: 720 },
  { id: "c5", number: 5, title: "Convergence", wordCount: 1100 },
];

export const genres = [
  "Sci-Fi", "Fantasy", "Literary Fiction", "Thriller", "Romance",
  "Business", "Self-Help", "Biography", "Horror", "Mystery",
];

export const coverSuggestions = [
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200&h=260&fit=crop",
  "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=200&h=260&fit=crop",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=260&fit=crop",
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=200&h=260&fit=crop",
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200&h=260&fit=crop",
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=200&h=260&fit=crop",
];

export const adminUsers = [
  { name: "Alex Morgan", email: "alex@folio.app", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face", books: 6, joined: "Jan 2024", status: "active" as const },
  { name: "Sarah Kim", email: "sarah@mail.com", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face", books: 12, joined: "Feb 2024", status: "active" as const },
  { name: "James Oliver", email: "james@mail.com", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face", books: 3, joined: "Mar 2024", status: "inactive" as const },
  { name: "Maria Chen", email: "maria@mail.com", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face", books: 8, joined: "Jan 2024", status: "active" as const },
  { name: "David Park", email: "david@mail.com", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face", books: 5, joined: "Apr 2024", status: "active" as const },
  { name: "Lena Rossi", email: "lena@mail.com", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face", books: 2, joined: "May 2024", status: "active" as const },
  { name: "Tom Hughes", email: "tom@mail.com", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=40&h=40&fit=crop&crop=face", books: 7, joined: "Feb 2024", status: "inactive" as const },
  { name: "Ava Williams", email: "ava@mail.com", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face", books: 4, joined: "Jun 2024", status: "active" as const },
];
