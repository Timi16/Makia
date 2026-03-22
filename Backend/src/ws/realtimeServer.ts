import { randomUUID } from "node:crypto";
import { IncomingMessage } from "node:http";

import { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { RawData, WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";

import { redis } from "../lib/redis";

interface PresenceState {
  connectionId: string;
  cursor: {
    x: number;
    y: number;
  } | null;
  name: string;
  userId: string;
}

interface RoomConnection extends PresenceState {
  socket: WebSocket;
}

interface RoomState {
  connections: Map<string, RoomConnection>;
  document: Y.Doc;
  initialized: Promise<void>;
  remotePresenceByNode: Map<string, PresenceState[]>;
}

interface ParsedRequest {
  bookId: string;
  name: string;
  userId: string;
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

type RealtimeSyncMessage = PresenceSyncMessage | YjsSyncMessage;

const rooms = new Map<string, RoomState>();
const nodeId = randomUUID();
const realtimeChannelPrefix = "realtime:room:";
const realtimeStatePrefix = "realtime:state:";

function getRoomChannel(bookId: string) {
  return `${realtimeChannelPrefix}${bookId}`;
}

function getRoomStateKey(bookId: string) {
  return `${realtimeStatePrefix}${bookId}`;
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

function parseRequest(request: IncomingMessage): ParsedRequest | null {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname !== "/ws") {
    return null;
  }

  const bookId = url.searchParams.get("bookId");

  if (!bookId) {
    return null;
  }

  return {
    bookId,
    name: url.searchParams.get("name") ?? "Anonymous",
    userId: url.searchParams.get("userId") ?? randomUUID(),
  };
}

function sendToConnection(connection: RoomConnection, payload: string | Uint8Array, isBinary = false) {
  if (connection.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  connection.socket.send(payload, { binary: isBinary });
}

function sendToSocket(socket: WebSocket, payload: string | Uint8Array, isBinary = false) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(payload, { binary: isBinary });
}

function getCombinedPresence(room: RoomState) {
  const localUsers = Array.from(room.connections.values()).map((connection) => ({
    connectionId: connection.connectionId,
    cursor: connection.cursor,
    name: connection.name,
    userId: connection.userId,
  }));
  const remoteUsers = Array.from(room.remotePresenceByNode.values()).flat();

  return [...localUsers, ...remoteUsers];
}

function broadcastPresence(room: RoomState) {
  const payload = JSON.stringify({
    type: "presence",
    users: getCombinedPresence(room),
  });

  room.connections.forEach((connection) => {
    sendToConnection(connection, payload);
  });
}

async function persistRoomDocument(bookId: string, room: RoomState) {
  const fullUpdate = Y.encodeStateAsUpdate(room.document);
  await redis.set(getRoomStateKey(bookId), encodeYjsUpdate(fullUpdate));
}

async function hydrateRoomDocument(bookId: string, room: RoomState) {
  const persistedState = await redis.get(getRoomStateKey(bookId));

  if (!persistedState) {
    return;
  }

  Y.applyUpdate(room.document, decodeYjsUpdate(persistedState));
}

async function publishPresence(bookId: string, room: RoomState, publisher: Redis) {
  const payload: PresenceSyncMessage = {
    nodeId,
    type: "presence-sync",
    users: Array.from(room.connections.values()).map((connection) => ({
      connectionId: connection.connectionId,
      cursor: connection.cursor,
      name: connection.name,
      userId: connection.userId,
    })),
  };

  await publisher.publish(getRoomChannel(bookId), JSON.stringify(payload));
}

async function publishYjsUpdate(bookId: string, update: Uint8Array, publisher: Redis) {
  const payload: YjsSyncMessage = {
    data: encodeYjsUpdate(update),
    nodeId,
    type: "yjs-update",
  };

  await publisher.publish(getRoomChannel(bookId), JSON.stringify(payload));
}

async function getOrCreateRoom(bookId: string) {
  let room = rooms.get(bookId);

  if (!room) {
    const document = new Y.Doc();
    room = {
      connections: new Map(),
      document,
      initialized: Promise.resolve(),
      remotePresenceByNode: new Map(),
    };
    room.initialized = hydrateRoomDocument(bookId, room);
    rooms.set(bookId, room);
  }

  await room.initialized;
  return room;
}

function cleanupRoom(bookId: string) {
  const room = rooms.get(bookId);

  if (!room || room.connections.size > 0) {
    return;
  }

  room.document.destroy();
  rooms.delete(bookId);
}

function applyRemoteRealtimeMessage(bookId: string, message: RealtimeSyncMessage) {
  const room = rooms.get(bookId);

  if (!room || message.nodeId === nodeId) {
    return;
  }

  if (message.type === "yjs-update") {
    const update = decodeYjsUpdate(message.data);
    Y.applyUpdate(room.document, update);

    room.connections.forEach((connection) => {
      sendToConnection(connection, update, true);
    });

    return;
  }

  room.remotePresenceByNode.set(message.nodeId, message.users);
  broadcastPresence(room);
}

async function handleRealtimeMessage(input: {
  bookId: string;
  connectionId: string;
  isBinary: boolean;
  message: Buffer;
  publisher: Redis;
  room: RoomState;
}) {
  const { bookId, connectionId, isBinary, message, publisher, room } = input;

  if (isBinary) {
    const update = new Uint8Array(message);
    Y.applyUpdate(room.document, update);
    await persistRoomDocument(bookId, room);
    await publishYjsUpdate(bookId, update, publisher);

    room.connections.forEach((connection) => {
      if (connection.connectionId !== connectionId) {
        sendToConnection(connection, update, true);
      }
    });

    return;
  }

  const payload = JSON.parse(message.toString()) as {
    cursor?: {
      x?: number;
      y?: number;
    } | null;
    name?: string;
    type?: string;
  };

  if (payload.type !== "presence") {
    return;
  }

  const connection = room.connections.get(connectionId);

  if (!connection) {
    return;
  }

  connection.name = payload.name?.trim() || connection.name;
  connection.cursor =
    payload.cursor && typeof payload.cursor.x === "number" && typeof payload.cursor.y === "number"
      ? {
          x: payload.cursor.x,
          y: payload.cursor.y,
        }
      : null;

  broadcastPresence(room);
  await publishPresence(bookId, room, publisher);
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

  subscriber.on("pmessage", (_pattern, channel, payload) => {
    const bookId = parseBookIdFromChannel(channel);

    if (!bookId) {
      return;
    }

    const message = JSON.parse(payload) as RealtimeSyncMessage;
    applyRemoteRealtimeMessage(bookId, message);
  });

  app.server.on("upgrade", (request, socket, head) => {
    const parsed = parseRequest(request);

    if (!parsed) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request, parsed);
    });
  });

  webSocketServer.on("connection", async (socket: WebSocket, _request: IncomingMessage, parsed: ParsedRequest) => {
    const room = await getOrCreateRoom(parsed.bookId);
    const connectionId = randomUUID();

    room.connections.set(connectionId, {
      connectionId,
      cursor: null,
      name: parsed.name,
      socket,
      userId: parsed.userId,
    });

    sendToSocket(socket, Y.encodeStateAsUpdate(room.document), true);
    broadcastPresence(room);
    await publishPresence(parsed.bookId, room, publisher);

    socket.on("message", (message, isBinary) => {
      void handleRealtimeMessage({
        bookId: parsed.bookId,
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
      void publishPresence(parsed.bookId, room, publisher).finally(() => {
        cleanupRoom(parsed.bookId);
      });
    });
  });

  app.addHook("onClose", async () => {
    await Promise.allSettled([
      new Promise<void>((resolve) => webSocketServer.close(() => resolve())),
      publisher.quit(),
      subscriber.quit(),
    ]);
  });
}
