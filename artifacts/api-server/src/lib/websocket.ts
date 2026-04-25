import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { verifyToken } from "./auth.js";
import { logger } from "./logger.js";

const userConnections = new Map<number, Set<WebSocket>>();

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "No token provided");
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      ws.close(4001, "Invalid token");
      return;
    }

    const userId = decoded.userId;

    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(ws);

    logger.info({ userId }, "WebSocket connection established");

    ws.on("close", () => {
      userConnections.get(userId)?.delete(ws);
      if (userConnections.get(userId)?.size === 0) {
        userConnections.delete(userId);
      }
    });

    ws.on("error", (err) => {
      logger.error({ err, userId }, "WebSocket error");
    });

    ws.send(JSON.stringify({ type: "connected", data: { userId } }));
  });

  return wss;
}

export function broadcastToUser(userId: number, payload: object) {
  const connections = userConnections.get(userId);
  if (!connections) return;

  const message = JSON.stringify(payload);
  for (const ws of connections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}
