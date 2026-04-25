import { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../artifacts/api-server/src/app";
import { initTelegramBots } from "../artifacts/api-server/src/lib/telegram";

// Initialize Telegram bots
initTelegramBots("webhook").catch(() => {});

// Vercel serverless handler that wraps the Express app
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
