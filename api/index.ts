import { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../artifacts/api-server/src/app.js";
import { initTelegramBots } from "../artifacts/api-server/src/lib/telegram.js";

// Initialize Telegram bots
initTelegramBots("webhook").catch(() => {});

// Vercel serverless handler that wraps the Express app
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
