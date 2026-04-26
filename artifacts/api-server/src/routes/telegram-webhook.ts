// @ts-nocheck
// @ts-nocheck
import { Router } from "express";
import {
  processTelegramUpdate,
  setTelegramWebhooks,
  deleteTelegramWebhooks,
  initTelegramBots,
} from "../lib/telegram";
import { logger } from "../lib/logger";

const router: Router = Router();

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const SETUP_TOKEN = process.env.TELEGRAM_WEBHOOK_SETUP_TOKEN || "";

function checkSecret(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  if (!WEBHOOK_SECRET) return false;
  const header = req.headers["x-telegram-bot-api-secret-token"];
  return header === WEBHOOK_SECRET;
}

async function handleIncoming(
  botType: "admin" | "support",
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1],
) {
  if (!WEBHOOK_SECRET) {
    logger.error("TELEGRAM_WEBHOOK_SECRET not configured — refusing webhook");
    res.status(500).json({ error: "webhook secret not configured" });
    return;
  }
  if (!checkSecret(req)) {
    res.status(401).json({ error: "invalid secret" });
    return;
  }
  try {
    await initTelegramBots("webhook");
  } catch (e) {
    logger.error({ e }, "bot init failed");
    res.status(500).json({ error: "bot init failed" });
    return;
  }
  try {
    processTelegramUpdate(botType, req.body);
    res.status(200).json({ ok: true });
  } catch (e) {
    logger.error({ e, botType }, "webhook processing failed");
    res.status(500).json({ error: "processing failed" });
  }
}

router.post("/webhook/admin", (req, res) => {
  void handleIncoming("admin", req, res);
});

router.post("/webhook/support", (req, res) => {
  void handleIncoming("support", req, res);
});

router.post("/setup-webhooks", async (req, res) => {
  const token = req.headers["x-setup-token"] || req.body?.setupToken;
  if (!SETUP_TOKEN || token !== SETUP_TOKEN) {
    res.status(401).json({ error: "invalid setup token" });
    return;
  }
  const baseUrl = req.body?.baseUrl;
  if (!baseUrl || typeof baseUrl !== "string" || !baseUrl.startsWith("https://")) {
    res.status(400).json({ error: "baseUrl required and must be https://" });
    return;
  }
  if (!WEBHOOK_SECRET) {
    res.status(500).json({ error: "TELEGRAM_WEBHOOK_SECRET not configured" });
    return;
  }
  try {
    const result = await setTelegramWebhooks(baseUrl.replace(/\/$/, ""), WEBHOOK_SECRET);
    res.json({ ok: true, ...result });
  } catch (e) {
    logger.error({ e }, "setup webhooks failed");
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post("/delete-webhooks", async (req, res) => {
  const token = req.headers["x-setup-token"] || req.body?.setupToken;
  if (!SETUP_TOKEN || token !== SETUP_TOKEN) {
    res.status(401).json({ error: "invalid setup token" });
    return;
  }
  try {
    await deleteTelegramWebhooks();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
