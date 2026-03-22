import { randomUUID } from "node:crypto";
import { IncomingMessage } from "node:http";

import { FastifyInstance } from "fastify";
import { RawData, WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";

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
}

const rooms = new Map<string, RoomState>();

function getRoom(bookId: string) {
  let room = rooms.get(bookId);

  if (!room) {
    room = {
      connections: new Map(),
      document: new Y.Doc(),
    };
    rooms.set(bookId, room);
  }

  return room;
}

function broadcastPresence(bookId: string) {
  const room = rooms.get(bookId);

  if (!room) {
    return;
  }

  const payload = JSON.stringify({
    type: "presence",
    users: Array.from(room.connections.values()).map((connection) => ({
      connectionId: connection.connectionId,
      cursor: connection.cursor,
      name: connection.name,
      userId: connection.userId,
    })),
  });

  room.connections.forEach((connection) => {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(payload);
    }
  });
}

function cleanupRoom(bookId: string) {
  const room = rooms.get(bookId);

  if (!room || room.connections.size > 0) {
    return;
  }

  room.document.destroy();
  rooms.delete(bookId);
}

function parseRequest(request: IncomingMessage) {
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

function handleRealtimeMessage(
  bookId: string,
  connectionId: string,
  room: RoomState,
  message: Buffer,
  isBinary: boolean
) {
  if (isBinary) {
    const update = new Uint8Array(message);
    Y.applyUpdate(room.document, update);

    room.connections.forEach((connection) => {
      if (connection.connectionId !== connectionId && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(update, { binary: true });
      }
    });

    return;
  }

  const payload = JSON.parse(message.toString()) as {
    type?: string;
    cursor?: {
      x?: number;
      y?: number;
    } | null;
    name?: string;
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

  broadcastPresence(bookId);
}

function rawDataToBuffer(message: RawData) {
  if (Array.isArray(message)) {
    return Buffer.concat(message);
  }

  return Buffer.isBuffer(message) ? message : Buffer.from(message);
}

export async function registerRealtimeServer(app: FastifyInstance) {
  const webSocketServer = new WebSocketServer({ noServer: true });

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

  webSocketServer.on(
    "connection",
    (socket: WebSocket, _request: IncomingMessage, parsed: NonNullable<ReturnType<typeof parseRequest>>) => {
      const room = getRoom(parsed.bookId);
      const connectionId = randomUUID();

      room.connections.set(connectionId, {
        connectionId,
        cursor: null,
        name: parsed.name,
        socket,
        userId: parsed.userId,
      });

      socket.send(Y.encodeStateAsUpdate(room.document), { binary: true });
      broadcastPresence(parsed.bookId);

      socket.on("message", (message, isBinary) => {
        handleRealtimeMessage(parsed.bookId, connectionId, room, rawDataToBuffer(message), isBinary);
      });

      socket.on("close", () => {
        room.connections.delete(connectionId);
        broadcastPresence(parsed.bookId);
        cleanupRoom(parsed.bookId);
      });
    }
  );
}
