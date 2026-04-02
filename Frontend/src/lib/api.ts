/// <reference types="vite/client" />

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface ApiErrorPayload {
  message?: string;
}

interface PresignUploadResponse {
  presignedUrl: string;
  s3Key: string;
  cdnUrl: string;
}

interface ConfirmUploadResponse {
  cdnUrl: string;
}

export interface ApiBook {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  genre: string | null;
  tags: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiChapter {
  id: string;
  bookId: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type ExportFormat = "EPUB" | "MOBI";
export type ExportJobStatus = "QUEUED" | "PROCESSING" | "DONE" | "FAILED";

interface CreateExportResponse {
  jobId: string;
}

export interface ExportStatusResponse {
  status: ExportJobStatus;
  fileUrl: string | null;
  errorMessage: string | null;
}

export interface AdminOverview {
  totalUsers: number;
  totalBooks: number;
  totalExports: number;
  newUsersLast30Days: number;
  activeUsersLast30Days: number;
}

export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersResponse {
  items: Array<{
    id: string;
    name: string;
    email: string;
    role: "USER" | "ADMIN";
    createdAt: string;
    booksCount: number;
    exportsCount: number;
    status: "active" | "inactive";
  }>;
  pagination: AdminPagination;
}

export interface AdminBooksResponse {
  items: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    owner: {
      id: string;
      name: string;
      email: string;
    };
    chaptersCount: number;
    exportsCount: number;
  }>;
  pagination: AdminPagination;
}

const ACCESS_TOKEN_KEY = "makia_access_token";
const USER_KEY = "makia_user";
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || " https://prefamiliar-unprecociously-pearlie.ngrok-free.dev";

let refreshPromise: Promise<void> | null = null;

function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

function readJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function persistAuth(payload: AuthResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  emitAuthChanged();
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthChanged();
}

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  const pathname = window.location.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  const targetPath = isAdminPath ? "/admin/login" : "/login";
  const isAuthPage =
    pathname === targetPath || pathname === "/register" || pathname === "/admin/login";

  if (!isAuthPage) {
    window.location.href = targetPath;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  return readJson<AuthUser>(localStorage.getItem(USER_KEY));
}

async function parseError(response: Response): Promise<never> {
  if (response.status === 401) {
    throw new Error("Unauthorized");
  }

  let message = `Request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      message = payload.message;
    }
  } catch {
    // fall back to default message
  }

  throw new Error(message);
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        clearAuth();
        throw new Error("Unauthorized");
      }

      const payload = (await response.json()) as AuthResponse;
      persistAuth(payload);
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options: { auth?: boolean; retry?: boolean } = {}
): Promise<T> {
  const auth = options.auth ?? true;
  const retry = options.retry ?? true;

  const headers = new Headers(init?.headers);
  const body = init?.body;
  const shouldSetJsonHeader = body !== undefined && !(body instanceof FormData) && !headers.has("Content-Type");

  if (shouldSetJsonHeader) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && auth && retry) {
    try {
      await refreshSession();
    } catch {
      clearAuth();
      redirectToLogin();
      throw new Error("Unauthorized");
    }
    return apiFetch<T>(path, init, { auth, retry: false });
  }

  if (response.status === 401) {
    clearAuth();
    redirectToLogin();
  }

  if (!response.ok) {
    await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string) {
  const payload = await apiFetch<AuthResponse>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false }
  );
  persistAuth(payload);
  return payload.user;
}

export async function adminLogin(email: string, password: string) {
  const payload = await apiFetch<AuthResponse>(
    "/api/auth/admin/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false }
  );
  persistAuth(payload);
  return payload.user;
}

export async function register(name: string, email: string, password: string) {
  const payload = await apiFetch<AuthResponse>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    },
    { auth: false }
  );
  persistAuth(payload);
  return payload.user;
}

export async function logout() {
  try {
    await apiFetch<void>("/api/auth/logout", { method: "POST" }, { auth: false, retry: false });
  } finally {
    clearAuth();
  }
}

export function ensureSession() {
  return refreshSession();
}

export function getBooks() {
  return apiFetch<ApiBook[]>("/api/books");
}

export function getBook(id: string) {
  return apiFetch<ApiBook>(`/api/books/${id}`);
}

export function createBook(input: {
  title: string;
  description?: string;
  coverUrl?: string;
  genre?: string;
  tags?: string[];
}) {
  return apiFetch<ApiBook>("/api/books", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBook(
  id: string,
  input: {
    title?: string;
    description?: string;
    coverUrl?: string;
    genre?: string;
    tags?: string[];
  }
) {
  return apiFetch<ApiBook>(`/api/books/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBook(id: string) {
  return apiFetch<void>(`/api/books/${id}`, {
    method: "DELETE",
  });
}

export function getChapters(bookId: string) {
  return apiFetch<ApiChapter[]>(`/api/books/${bookId}/chapters`);
}

export function createChapter(bookId: string, input: { title: string; content?: string }) {
  return apiFetch<ApiChapter>(`/api/books/${bookId}/chapters`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateChapter(id: string, input: { title?: string; content?: string }) {
  return apiFetch<ApiChapter>(`/api/chapters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteChapter(id: string) {
  return apiFetch<void>(`/api/chapters/${id}`, {
    method: "DELETE",
  });
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function createBookExport(bookId: string, format: ExportFormat) {
  return apiFetch<CreateExportResponse>("/api/export", {
    method: "POST",
    body: JSON.stringify({
      bookId,
      format,
    }),
  });
}

export function getBookExportStatus(jobId: string) {
  return apiFetch<ExportStatusResponse>(`/api/export/${jobId}/status`);
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return;
    }

    query.set(key, String(value));
  });

  const raw = query.toString();
  return raw.length > 0 ? `?${raw}` : "";
}

export function getAdminOverview() {
  return apiFetch<AdminOverview>("/api/admin/overview");
}

export function getAdminUsers(input: { page?: number; pageSize?: number; search?: string } = {}) {
  const query = buildQuery({
    page: input.page,
    pageSize: input.pageSize,
    search: input.search,
  });

  return apiFetch<AdminUsersResponse>(`/api/admin/users${query}`);
}

export function getAdminBooks(input: { page?: number; pageSize?: number; search?: string } = {}) {
  const query = buildQuery({
    page: input.page,
    pageSize: input.pageSize,
    search: input.search,
  });

  return apiFetch<AdminBooksResponse>(`/api/admin/books${query}`);
}

export async function uploadBookCover(bookId: string, file: File) {
  const presign = await apiFetch<PresignUploadResponse>("/api/storage/presign", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name || "cover-upload",
      fileType: file.type || "image/jpeg",
      bookId,
      assetKind: "cover",
    }),
  });

  const uploadResponse = await fetch(presign.presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload cover file");
  }

  const confirm = await apiFetch<ConfirmUploadResponse>("/api/storage/confirm", {
    method: "POST",
    body: JSON.stringify({
      s3Key: presign.s3Key,
      bookId,
      fileType: file.type || "image/jpeg",
      assetKind: "cover",
    }),
  });

  const updatedBook = await updateBook(bookId, {
    coverUrl: confirm.cdnUrl,
  });

  return updatedBook.coverUrl ?? confirm.cdnUrl;
}
