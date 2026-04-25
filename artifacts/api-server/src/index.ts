// @ts-nocheck
import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initWebSocket } from "./lib/websocket";
import { initTelegramBots } from "./lib/telegram";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
initWebSocket(httpServer);
initTelegramBots().catch((e) => logger.error({ e }, "Failed to init Telegram bots"));

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
