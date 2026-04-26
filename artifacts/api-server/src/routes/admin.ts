import { Router } from "express";
import { db, supportMessagesTable, notificationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/admin"; // Using the middleware you made!

const router = Router();

// Lock down every route in this file
router.use(requireAdmin);

// 1. Get the list of users who have open support tickets
router.get("/support/conversations", async (req, res) => {
  try {
    const conversations = await db.execute(sql`
      SELECT DISTINCT u.id, u.username, u.email, u.first_name, u.last_name
      FROM support_messages sm
      JOIN users u ON sm.user_id = u.id
      ORDER BY u.id DESC
    `);
    res.json(conversations.rows);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// 2. Get the full chat history with a specific user
router.get("/support/messages/:userId", async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    const messages = await db.select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.userId, targetUserId))
      .orderBy(supportMessagesTable.createdAt); 
      
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// 3. Admin sends a reply
router.post("/support/reply/:userId", async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });

    // Save the admin's reply
    await db.insert(supportMessagesTable).values({
      userId: targetUserId,
      message: message,
      isFromUser: false, // false = Admin message
    });

    // Alert the user on their dashboard
    await db.insert(notificationsTable).values({
      userId: targetUserId,
      type: "support",
      title: "Support Reply",
      message: "Customer Service has replied to your message.",
    });

    res.status(201).json({ success: true, message: "Reply sent successfully" });
  } catch (error) {
    console.error("Error sending reply:", error);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

export default router;