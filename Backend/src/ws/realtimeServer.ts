import { randomUUID } from "node:crypto";
import { IncomingMessage } from "node:http";
import { Duplex } from "node:stream";

import { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { RawData, WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";

import { BookAccessRole, canWriteBook, getBookAccess } from "../lib/bookAccess";
import { redis } from "../lib/redis";
import { withAdminRls, withUserRls } from "../lib/rls";
import { AuthenticatedUser, authService } from "../services/authService";

/**
 * Realtime collaboration server.
 *
 * One Yjs document per book; each chapter's body lives in `doc.getText(chapterId)`.
 * Clients connect to `/ws?bookId=<uuid>&token=<access token>`.
 *
 *   client -> server  binary  : Yjs update
 *   client -> server  JSON    : { type: "presence", chapterId }
 *   server -> client  binary  : Yjs update (full state on connect, then deltas)
 *   server -> client  JSON    : { type: "ready", role, connectionId }
 *                               { type: "presence", users: PresenceState[] }
 *                               { type: "saved", chapterIds, savedAt }
 *                               { type: "access-revoked" }  (then close 4003)
 *
 * The document is mirrored to Redis on every update (so other API nodes can
 * hydrate the same room) and flushed to Postgres `chapters.content` shortly
 * after edits stop, creating a chapter version each time.
 */

interface PresenceState {
  chapterId: string | null;
  connectionId: string;
  name: string;
  userId: string;
}

interface RoomConnection extends PresenceState {
  role: BookAccessRole;
  socket: WebSocket;
}

interface RoomState {
  connections: Map<string, RoomConnection>;
  document: Y.Doc;
  flushTimer: NodeJS.Timeout | null;
  flushing: Promise<void> | null;
  initialized: Promise<void>;
  lastPersisted: Map<string, string>;
  remotePresenceByNode: Map<string, PresenceState[]>;
}

interface ConnectionContext {
  bookId: string;
  role: BookAccessRole;
  user: AuthenticatedUser;
}

interface PresenceSyncMessage {
  nodeId: string;
  type: "presence-sync";
  users: PresenceState[];
}

interface YjsSyncMessage {
  data: string;
  nodeId: string;
  type: "yjs-update";
}

interface SavedSyncMessage {
  chapterIds: string[];
  nodeId: string;
  savedAt: string;
  type: "saved-sync";
}

interface AccessRevokedMessage {
  nodeId: string;
  type: "access-revoked";
  userId: string;
}

interface BookSyncMessage {
  nodeId: string;
  type: "book-sync";
}

type RealtimeSyncMessage =
  | PresenceSyncMessage
  | YjsSyncMessage
  | SavedSyncMessage
  | AccessRevokedMessage
  | BookSyncMessage;

const CLOSE_UNAUTHORIZED = 4001;
const CLOSE_FORBIDDEN = 4003;
const FLUSH_DELAY_MS = 1500;

const rooms = new Map<string, RoomState>();
const nodeId = randomUUID();
const realtimeChannelPrefix = "realtime:room:";
const realtimeStatePrefix = "realtime:state:";
const realtimeFlushedPrefix = "realtime:flushed:";

function getRoomChannel(bookId: string) {
  return `${realtimeChannelPrefix}${bookId}`;
}

function getRoomStateKey(bookId: string) {
  return `${realtimeStatePrefix}${bookId}`;
}

function getRoomFlushedKey(bookId: string) {
  return `${realtimeFlushedPrefix}${bookId}`;
}

function parseBookIdFromChannel(channel: string) {
  if (!channel.startsWith(realtimeChannelPrefix)) {
    return null;
  }

  return channel.slice(realtimeChannelPrefix.length);
}

function rawDataToBuffer(message: RawData) {
  if (Array.isArray(message)) {
    return Buffer.concat(message);
  }

  return Buffer.isBuffer(message) ? message : Buffer.from(message);
}

function encodeYjsUpdate(update: Uint8Array) {
  return Buffer.from(update).toString("base64");
}

function decodeYjsUpdate(data: string) {
  return new Uint8Array(Buffer.from(data, "base64"));
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRequest(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname !== "/ws") {
    return null;
  }

  const bookId = url.searchParams.get("bookId");
  const token = url.searchParams.get("token");

  if (!bookId || !uuidPattern.test(bookId) || !token) {
    return null;
  }

  return { bookId, token };
}

function rejectUpgrade(socket: Duplex, status: number, reason: string) {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sendBinary(socket: WebSocket, payload: Uint8Array) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(payload, { binary: true });
  }
}

function toPresence(connection: RoomConnection): PresenceState {
  return {
    chapterId: connection.chapterId,
    connectionId: connection.connectionId,
    name: connection.name,
    userId: connection.userId,
  };
}

function getCombinedPresence(room: RoomState) {
  const localUsers = Array.from(room.connections.values()).map(toPresence);
  const remoteUsers = Array.from(room.remotePresenceByNode.values()).flat();

  return [...localUsers, ...remoteUsers];
}

function broadcastJson(room: RoomState, payload: unknown, exceptConnectionId?: string) {
  const serialized = JSON.stringify(payload);

  room.connections.forEach((connection) => {
    if (connection.connectionId !== exceptConnectionId && connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(serialized);
    }
  });
}

function broadcastPresence(room: RoomState) {
  broadcastJson(room, { type: "presence", users: getCombinedPresence(room) });
}

async function persistRoomDocument(bookId: string, room: RoomState) {
  const fullUpdate = Y.encodeStateAsUpdate(room.document);
  await redis.set(getRoomStateKey(bookId), encodeYjsUpdate(fullUpdate));
}

/**
 * Loads the room document from Redis (if another node/previous run left one)
 * and reconciles it with Postgres so chapters edited through the REST API,
 * or never opened in realtime, start from their saved content.
 */
async function hydrateRoomDocument(bookId: string, room: RoomState) {
  const [persistedState, flushedAtRaw] = await redis.mget(
    getRoomStateKey(bookId),
    getRoomFlushedKey(bookId)
  );

  if (persistedState) {
    Y.applyUpdate(room.document, decodeYjsUpdate(persistedState), "hydrate");
  }

  const flushedAt = flushedAtRaw ? Number(flushedAtRaw) : 0;
  const chapters = await withAdminRls((tx) =>
    tx.chapter.findMany({
      where: { bookId },
      select: { id: true, content: true, updatedAt: true },
    })
  );

  room.document.transact(() => {
    chapters.forEach((chapter) => {
      const text = room.document.getText(chapter.id);
      const current = text.toString();
      const neverSynced = current.length === 0 && chapter.content.length > 0;
      const restIsNewer = chapter.updatedAt.getTime() > flushedAt && current !== chapter.content;

      if (neverSynced || restIsNewer) {
        if (current.length > 0) {
          text.delete(0, current.length);
        }

        if (chapter.content.length > 0) {
          text.insert(0, chapter.content);
        }
      }

      room.lastPersisted.set(chapter.id, chapter.content);
    });
  }, "hydrate");
}

async function publish(bookId: string, publisher: Redis, payload: RealtimeSyncMessage) {
  await publisher.publish(getRoomChannel(bookId), JSON.stringify(payload));
}

async function publishPresence(bookId: string, room: RoomState, publisher: Redis) {
  await publish(bookId, publisher, {
    nodeId,
    type: "presence-sync",
    users: Array.from(room.connections.values()).map(toPresence),
  });
}

async function getOrCreateRoom(bookId: string) {
  let room = rooms.get(bookId);

  if (!room) {
    const document = new Y.Doc();
    room = {
      connections: new Map(),
      document,
      flushTimer: null,
      flushing: null,
      initialized: Promise.resolve(),
      lastPersisted: new Map(),
      remotePresenceByNode: new Map(),
    };
    room.initialized = hydrateRoomDocument(bookId, room);
    rooms.set(bookId, room);
  }

  await room.initialized;
  return room;
}

/**
 * Writes every chapter whose realtime text differs from what was last
 * persisted back to Postgres, recording a chapter version for history.
 */
async function flushRoom(bookId: string, room: RoomState, publisher: Redis, app: FastifyInstance) {
  if (room.flushing) {
    await room.flushing;
  }

  if (room.flushTimer) {
    clearTimeout(room.flushTimer);
    room.flushTimer = null;
  }

  const changed: { id: string; content: string }[] = [];

  room.document.share.forEach((_type, key) => {
    if (!uuidPattern.test(key)) {
      return;
    }

    const content = room.document.getText(key).toString();

    if (room.lastPersisted.get(key) !== content) {
      changed.push({ id: key, content });
    }
  });

  if (changed.length === 0) {
    return;
  }

  const run = (async () => {
    const savedChapterIds: string[] = [];

    await withAdminRls(async (tx) => {
      for (const chapter of changed) {
        const result = await tx.chapter.updateMany({
          where: { id: chapter.id, bookId },
          data: { content: chapter.content },
        });

        if (result.count > 0) {
          await tx.chapterVersion.create({
            data: { chapterId: chapter.id, content: chapter.content },
          });
          savedChapterIds.push(chapter.id);
        }
      }
    });

    changed.forEach((chapter) => room.lastPersisted.set(chapter.id, chapter.content));

    const savedAt = new Date().toISOString();
    await redis.set(getRoomFlushedKey(bookId), String(Date.now()));

    if (savedChapterIds.length > 0) {
      broadcastJson(room, { type: "saved", chapterIds: savedChapterIds, savedAt });
      await publish(bookId, publisher, { nodeId, type: "saved-sync", chapterIds: savedChapterIds, savedAt });
    }
  })();

  room.flushing = run;

  try {
    await run;
  } catch (error) {
    app.log.error(error, "Failed to persist realtime document");
  } finally {
    if (room.flushing === run) {
      room.flushing = null;
    }
  }
}

function scheduleFlush(bookId: string, room: RoomState, publisher: Redis, app: FastifyInstance) {
  if (room.flushTimer) {
    clearTimeout(room.flushTimer);
  }

  room.flushTimer = setTimeout(() => {
    room.flushTimer = null;
    void flushRoom(bookId, room, publisher, app);
  }, FLUSH_DELAY_MS);
}

async function cleanupRoom(bookId: string, publisher: Redis, app: FastifyInstance) {
  const room = rooms.get(bookId);

  if (!room || room.connections.size > 0) {
    return;
  }

  await flushRoom(bookId, room, publisher, app);

  if (room.connections.size > 0 || rooms.get(bookId) !== room) {
    return;
  }

  room.document.destroy();
  rooms.delete(bookId);
}

function closeConnectionsForUser(room: RoomState, userId: string) {
  room.connections.forEach((connection) => {
    if (connection.userId === userId) {
      sendJson(connection.socket, { type: "access-revoked" });
      connection.socket.close(CLOSE_FORBIDDEN, "Access revoked");
    }
  });
}

function applyRemoteRealtimeMessage(bookId: string, message: RealtimeSyncMessage) {
  const room = rooms.get(bookId);

  if (!room) {
    return;
  }

  if (message.type === "access-revoked") {
    closeConnectionsForUser(room, message.userId);
    return;
  }

  if (message.type === "book-sync") {
    // Chapter list / titles / book metadata changed through the REST API.
    broadcastJson(room, { type: "book-changed" });
    return;
  }

  if (message.nodeId === nodeId) {
    return;
  }

  if (message.type === "yjs-update") {
    const update = decodeYjsUpdate(message.data);
    Y.applyUpdate(room.document, update, "remote-node");

    room.connections.forEach((connection) => {
      sendBinary(connection.socket, update);
    });

    return;
  }

  if (message.type === "saved-sync") {
    broadcastJson(room, { type: "saved", chapterIds: message.chapterIds, savedAt: message.savedAt });
    return;
  }

  room.remotePresenceByNode.set(message.nodeId, message.users);
  broadcastPresence(room);
}

async function handleRealtimeMessage(input: {
  app: FastifyInstance;
  bookId: string;
  connectionId: string;
  isBinary: boolean;
  message: Buffer;
  publisher: Redis;
  room: RoomState;
}) {
  const { app, bookId, connectionId, isBinary, message, publisher, room } = input;
  const connection = room.connections.get(connectionId);

  if (!connection) {
    return;
  }

  if (isBinary) {
    if (!canWriteBook(connection.role)) {
      return;
    }

    const update = new Uint8Array(message);
    Y.applyUpdate(room.document, update, connectionId);

    room.connections.forEach((peer) => {
      if (peer.connectionId !== connectionId) {
        sendBinary(peer.socket, update);
      }
    });

    scheduleFlush(bookId, room, publisher, app);
    await Promise.all([persistRoomDocument(bookId, room), publish(bookId, publisher, { data: encodeYjsUpdate(update), nodeId, type: "yjs-update" })]);

    return;
  }

  let payload: { chapterId?: unknown; type?: unknown };

  try {
    payload = JSON.parse(message.toString()) as { chapterId?: unknown; type?: unknown };
  } catch {
    return;
  }

  if (payload.type !== "presence") {
    return;
  }

  connection.chapterId =
    typeof payload.chapterId === "string" && uuidPattern.test(payload.chapterId) ? payload.chapterId : null;

  broadcastPresence(room);
  await publishPresence(bookId, room, publisher);
}

async function authorizeConnection(request: IncomingMessage): Promise<ConnectionContext | { error: number }> {
  const parsed = parseRequest(request);

  if (!parsed) {
    return { error: 400 };
  }

  let user: AuthenticatedUser;

  try {
    user = authService.verifyAccessToken(parsed.token);
  } catch {
    return { error: 401 };
  }

  const role = await withUserRls(user.id, (tx) => getBookAccess(tx, parsed.bookId, user.id));

  if (!role) {
    return { error: 403 };
  }

  return { bookId: parsed.bookId, role, user };
}

let revokePublisher: Redis | null = null;

/**
 * Disconnects every live realtime session of `userId` on `bookId`, on every
 * API node. Called when a collaborator is removed.
 */
export async function revokeRealtimeAccess(bookId: string, userId: string) {
  if (!revokePublisher) {
    return;
  }

  await publish(bookId, revokePublisher, { nodeId, type: "access-revoked", userId });
}

/**
 * Tells every client in the book's room to re-fetch the book and chapter
 * list (chapter created/deleted/reordered/renamed, book metadata changed).
 */
export async function notifyBookChanged(bookId: string) {
  if (!revokePublisher) {
    return;
  }

  await publish(bookId, revokePublisher, { nodeId, type: "book-sync" }).catch(() => undefined);
}

export async function registerRealtimeServer(app: FastifyInstance) {
  const webSocketServer = new WebSocketServer({ noServer: true });
  const publisher = redis.duplicate();
  const subscriber = redis.duplicate();

  await Promise.all([
    publisher.connect().catch(() => undefined),
    subscriber.connect().catch(() => undefined),
  ]);
  await subscriber.psubscribe(`${realtimeChannelPrefix}*`);
  revokePublisher = publisher;

  subscriber.on("pmessage", (_pattern, channel, payload) => {
    const bookId = parseBookIdFromChannel(channel);

    if (!bookId) {
      return;
    }

    try {
      applyRemoteRealtimeMessage(bookId, JSON.parse(payload) as RealtimeSyncMessage);
    } catch (error) {
      app.log.error(error, "Failed to apply realtime sync message");
    }
  });

  app.server.on("upgrade", (request, socket, head) => {
    void authorizeConnection(request)
      .then((result) => {
        if ("error" in result) {
          const reason =
            result.error === 401 ? "Unauthorized" : result.error === 403 ? "Forbidden" : "Bad Request";
          rejectUpgrade(socket, result.error, reason);
          return;
        }

        webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
          webSocketServer.emit("connection", webSocket, request, result);
        });
      })
      .catch((error) => {
        app.log.error(error, "Realtime upgrade failed");
        rejectUpgrade(socket, 500, "Internal Server Error");
      });
  });

  webSocketServer.on("connection", async (socket: WebSocket, _request: IncomingMessage, context: ConnectionContext) => {
    let room: RoomState;

    try {
      room = await getOrCreateRoom(context.bookId);
    } catch (error) {
      app.log.error(error, "Failed to open realtime room");
      socket.close(1011, "Room unavailable");
      return;
    }

    const connectionId = randomUUID();

    room.connections.set(connectionId, {
      chapterId: null,
      connectionId,
      name: context.user.name,
      role: context.role,
      socket,
      userId: context.user.id,
    });

    sendJson(socket, { type: "ready", role: context.role, connectionId });
    sendBinary(socket, Y.encodeStateAsUpdate(room.document));
    broadcastPresence(room);
    await publishPresence(context.bookId, room, publisher);

    socket.on("message", (message, isBinary) => {
      void handleRealtimeMessage({
        app,
        bookId: context.bookId,
        connectionId,
        isBinary,
        message: rawDataToBuffer(message),
        publisher,
        room,
      }).catch((error) => {
        app.log.error(error, "Realtime message handling failed");
      });
    });

    socket.on("close", () => {
      room.connections.delete(connectionId);
      broadcastPresence(room);
      void publishPresence(context.bookId, room, publisher)
        .catch(() => undefined)
        .finally(() => cleanupRoom(context.bookId, publisher, app));
    });
  });

  app.addHook("onClose", async () => {
    revokePublisher = null;

    await Promise.allSettled(
      Array.from(rooms.entries()).map(([bookId, room]) => flushRoom(bookId, room, publisher, app))
    );

    await Promise.allSettled([
      new Promise<void>((resolve) => webSocketServer.close(() => resolve())),
      publisher.quit(),
      subscriber.quit(),
    ]);
  });
}

export { CLOSE_FORBIDDEN, CLOSE_UNAUTHORIZED };
