// @ts-nocheck
// @ts-nocheck
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import walletRouter from "./routes/wallet.js";
import transactionsRouter from "./routes/transactions.js";
import kycRouter from "./routes/kyc.js";
import cardsRouter from "./routes/cards.js";
import giftcardsRouter from "./routes/giftcards.js";
import notificationsRouter from "./routes/notifications.js";
import supportRouter from "./routes/support.js";
import locationRouter from "./routes/location.js";
import vaultsRouter from "./routes/vaults.js";
import cryptoRouter from "./routes/crypto.js";
import telegramWebhookRouter from "./routes/telegram-webhook.js";

export const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
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
app.use("/api/crypto", cryptoRouter);
app.use("/api/telegram", telegramWebhookRouter);

export default app;
