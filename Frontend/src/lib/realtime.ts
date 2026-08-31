import * as Y from "yjs";

import { ensureSession, getAccessToken, getApiBaseUrl, type BookAccessRole } from "@/lib/api";

/**
 * Client for the backend realtime server (see Backend/src/ws/realtimeServer.ts).
 *
 * One Yjs document per book, one `Y.Text` per chapter keyed by chapter id.
 * Local edits are applied to the document with `LOCAL_ORIGIN`; the document's
 * update stream is forwarded to the server. Updates from the server are
 * applied with `REMOTE_ORIGIN` so observers can tell the two apart.
 */

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "offline" | "revoked";

export interface PresenceUser {
  chapterId: string | null;
  connectionId: string;
  name: string;
  userId: string;
}

export interface RealtimeHandlers {
  /** The chapter list, a chapter title, or book metadata changed via the API. */
  onBookChanged?: () => void;
  onPresence?: (users: PresenceUser[]) => void;
  onReady?: (role: BookAccessRole, connectionId: string) => void;
  onSaved?: (chapterIds: string[], savedAt: string) => void;
  onStatus?: (status: RealtimeStatus) => void;
  /** Fired each time the full server state has been received after (re)connecting. */
  onSynced?: () => void;
}

export const LOCAL_ORIGIN = "local";
export const REMOTE_ORIGIN = "remote";

const CLOSE_UNAUTHORIZED = 4001;
const CLOSE_FORBIDDEN = 4003;
const MAX_RECONNECT_DELAY_MS = 15_000;

export function getRealtimeUrl(bookId: string, token: string) {
  const base = getApiBaseUrl().replace(/^http/i, "ws");
  const url = new URL("/ws", base);
  url.searchParams.set("bookId", bookId);
  url.searchParams.set("token", token);
  return url.toString();
}

export class BookRealtime {
  readonly doc = new Y.Doc();

  connectionId: string | null = null;
  role: BookAccessRole | null = null;
  status: RealtimeStatus = "connecting";

  private attempts = 0;
  private chapterId: string | null = null;
  private closed = false;
  private reconnectTimer: number | null = null;
  private socket: WebSocket | null = null;
  private synced = false;
  private syncedOnce = false;

  constructor(
    private readonly bookId: string,
    private readonly handlers: RealtimeHandlers
  ) {
    this.doc.on("update", this.handleDocUpdate);
    this.connect();
  }

  /** True once the server state has been received at least once in this session. */
  get hasSyncedOnce() {
    return this.syncedOnce;
  }

  /** True while connected and holding the server's current state. */
  get isLive() {
    return this.status === "connected" && this.synced;
  }

  getText(chapterId: string) {
    return this.doc.getText(chapterId);
  }

  sendPresence(chapterId: string | null = this.chapterId) {
    this.chapterId = chapterId;

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "presence", chapterId }));
    }
  }

  destroy() {
    this.closed = true;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.doc.off("update", this.handleDocUpdate);

    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "Editor closed");

    this.doc.destroy();
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) {
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(update);
    }
  };

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.handlers.onStatus?.(status);
  }

  private connect() {
    if (this.closed) {
      return;
    }

    const token = getAccessToken();

    if (!token) {
      this.setStatus("offline");
      this.scheduleReconnect();
      return;
    }

    const socket = new WebSocket(getRealtimeUrl(this.bookId, token));
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    this.synced = false;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }

      this.attempts = 0;
      this.setStatus("connected");

      // Push anything edited while offline so the server can merge it.
      if (this.syncedOnce) {
        socket.send(Y.encodeStateAsUpdate(this.doc));
      }

      this.sendPresence();
    };

    socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      if (this.socket !== socket) {
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        Y.applyUpdate(this.doc, new Uint8Array(event.data), REMOTE_ORIGIN);

        if (!this.synced) {
          this.synced = true;
          this.syncedOnce = true;
          this.handlers.onSynced?.();
        }

        return;
      }

      let payload: {
        chapterIds?: string[];
        connectionId?: string;
        role?: BookAccessRole;
        savedAt?: string;
        type?: string;
        users?: PresenceUser[];
      };

      try {
        payload = JSON.parse(event.data) as typeof payload;
      } catch {
        return;
      }

      switch (payload.type) {
        case "ready":
          this.role = payload.role ?? null;
          this.connectionId = payload.connectionId ?? null;
          if (payload.role && payload.connectionId) {
            this.handlers.onReady?.(payload.role, payload.connectionId);
          }
          break;
        case "presence":
          this.handlers.onPresence?.(payload.users ?? []);
          break;
        case "saved":
          this.handlers.onSaved?.(payload.chapterIds ?? [], payload.savedAt ?? new Date().toISOString());
          break;
        case "book-changed":
          this.handlers.onBookChanged?.();
          break;
        case "access-revoked":
          this.closed = true;
          this.setStatus("revoked");
          break;
        default:
          break;
      }
    };

    socket.onclose = (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }

      this.synced = false;

      if (this.closed) {
        if (this.status !== "revoked") {
          this.setStatus("offline");
        }
        return;
      }

      if (event.code === CLOSE_FORBIDDEN) {
        this.closed = true;
        this.setStatus("revoked");
        return;
      }

      this.setStatus("reconnecting");

      if (event.code === CLOSE_UNAUTHORIZED) {
        // Access token expired or invalid: refresh the session, then retry.
        void ensureSession()
          .catch(() => undefined)
          .finally(() => this.scheduleReconnect());
        return;
      }

      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // The close event that follows drives reconnection.
    };
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer !== null) {
      return;
    }

    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(this.attempts, 4));
    this.attempts += 1;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

/**
 * Applies the minimal edit that turns the text's current value into `next`
 * (common prefix/suffix diff), as a single local transaction.
 */
export function applyTextDiff(text: Y.Text, next: string, origin: unknown = LOCAL_ORIGIN) {
  const prev = text.toString();

  if (prev === next) {
    return;
  }

  const minLength = Math.min(prev.length, next.length);
  let start = 0;

  while (start < minLength && prev.charCodeAt(start) === next.charCodeAt(start)) {
    start += 1;
  }

  let prevEnd = prev.length;
  let nextEnd = next.length;

  while (prevEnd > start && nextEnd > start && prev.charCodeAt(prevEnd - 1) === next.charCodeAt(nextEnd - 1)) {
    prevEnd -= 1;
    nextEnd -= 1;
  }

  const doc = text.doc;
  const apply = () => {
    if (prevEnd > start) {
      text.delete(start, prevEnd - start);
    }

    if (nextEnd > start) {
      text.insert(start, next.slice(start, nextEnd));
    }
  };

  if (doc) {
    doc.transact(apply, origin);
  } else {
    apply();
  }
}

type TextDelta = Y.YTextEvent["delta"];

/**
 * Maps a caret position in the pre-change text to the equivalent position
 * after a remote change described by a Yjs delta.
 */
export function transformCursor(delta: TextDelta, cursor: number) {
  let oldIndex = 0;
  let shift = 0;

  for (const op of delta) {
    if (oldIndex >= cursor) {
      break;
    }

    if (op.retain !== undefined) {
      oldIndex += op.retain;
      continue;
    }

    if (op.insert !== undefined) {
      shift += typeof op.insert === "string" ? op.insert.length : 1;
      continue;
    }

    if (op.delete !== undefined) {
      shift -= Math.min(op.delete, cursor - oldIndex);
      oldIndex += op.delete;
    }
  }

  return Math.max(0, cursor + shift);
}
