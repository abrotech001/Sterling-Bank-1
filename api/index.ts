import app from "../artifacts/api-server/src/app.js";
import { initTelegramBots } from "../artifacts/api-server/src/lib/telegram.js";

// Initialize Telegram bots
initTelegramBots("webhook").catch(() => {});

// Vercel handles Express apps natively, so we just export the app directly!
export default app;
