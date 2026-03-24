/// <reference types="vite/client" />

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface ApiErrorPayload {
  message?: string;
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

const ACCESS_TOKEN_KEY = "makia_access_token";
const USER_KEY = "makia_user";
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:4000";

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

  const isAuthPage = window.location.pathname === "/login" || window.location.pathname === "/register";
  if (!isAuthPage) {
    window.location.href = "/login";
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

export function updateChapter(id: string, input: { content: string }) {
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
