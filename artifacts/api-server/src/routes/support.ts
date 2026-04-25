// @ts-nocheck
import { Router } from "express";
import { db } from "@workspace/db";
import { supportMessagesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getSupportBot } from "../lib/telegram";

const router = Router();

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

router.post("/message", requireAuth, async (req, res) => {
  const { message } = req.body;
  const userId = req.userId!;
  const user = req.user!;

  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    const supportBot = getSupportBot();
    let telegramMsgId: number | null = null;

    if (supportBot && ADMIN_CHAT_ID) {
      try {
        const tgMsg = await supportBot.sendMessage(
          ADMIN_CHAT_ID,
          `💬 SUPPORT MESSAGE\n\nFrom: @${user.username} (User #${userId})\nEmail: ${user.email}\n\n${message.trim()}\n\nReply to this message to respond to the user.`
        );
        telegramMsgId = tgMsg.message_id;
      } catch (e) {
        req.log.warn({ e }, "Could not send to Telegram support");
      }
    }

    const [msg] = await db.insert(supportMessagesTable).values({
      userId,
      message: message.trim(),
      isFromUser: true,
      telegramMessageId: telegramMsgId,
    }).returning();

    res.status(201).json({ success: true, message: "Message sent" });
  } catch (e) {
    req.log.error({ e }, "Error sending support message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.delete("/messages", requireAuth, async (req, res) => {
  try {
    await db.delete(supportMessagesTable).where(eq(supportMessagesTable.userId, req.userId!));

    const supportBot = getSupportBot();
    const user = req.user!;
    if (supportBot && ADMIN_CHAT_ID) {
      supportBot.sendMessage(
        ADMIN_CHAT_ID,
        `🔚 SESSION ENDED\n\nUser: @${user.username} (User #${req.userId}) has ended their support session and cleared the chat.`
      ).catch(() => {});
    }

    res.json({ success: true, message: "Support session ended" });
  } catch (e) {
    req.log.error({ e }, "Error ending support session");
    res.status(500).json({ error: "Failed to end session" });
  }
});

router.get("/messages", requireAuth, async (req, res) => {
  try {
    const messages = await db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.userId, req.userId!))
      .orderBy(asc(supportMessagesTable.createdAt));

    res.json({
      messages: messages.map(m => ({
        id: m.id,
        userId: m.userId,
        message: m.message,
        isFromUser: m.isFromUser,
        isFromAgent: !m.isFromUser,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    req.log.error({ e }, "Error getting support messages");
    res.status(500).json({ error: "Failed to get messages" });
  }
});

export default router;
