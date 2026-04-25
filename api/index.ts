import app from "../artifacts/api-server/src/app";
import { initTelegramBots } from "../artifacts/api-server/src/lib/telegram";

initTelegramBots("webhook").catch(() => {});

export default app;
