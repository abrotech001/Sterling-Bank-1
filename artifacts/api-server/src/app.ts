import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createServer } from "http";
import { logger } from "./lib/logger";
import { initWebSocket } from "./lib/websocket";
import { initTelegramBots } from "./lib/telegram";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import walletRouter from "./routes/wallet";
import transactionsRouter from "./routes/transactions";
import kycRouter from "./routes/kyc";
import cardsRouter from "./routes/cards";
import giftcardsRouter from "./routes/giftcards";
import notificationsRouter from "./routes/notifications";
import supportRouter from "./routes/support";
import locationRouter from "./routes/location";
import vaultsRouter from "./routes/vaults";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/kyc", kycRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/gift-cards", giftcardsRouter);
app.use("/api/giftcards", giftcardsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/support", supportRouter);
app.use("/api/ip-location", locationRouter);
app.use("/api/location", locationRouter);
app.use("/api/vaults", vaultsRouter);

const httpServer = createServer(app);
initWebSocket(httpServer);

initTelegramBots().catch(e => logger.error({ e }, "Failed to init Telegram bots"));

export default httpServer;
