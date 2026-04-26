// @ts-nocheck
// @ts-nocheck
import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (e) {
    req.log.error({ e }, "Error getting notifications");
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const notifId = parseInt(req.params["id"] as string);
  const userId = req.userId!;

  try {
    const [notif] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, notifId));
    if (!notif || notif.userId !== userId) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, notifId));
    res.json({ success: true });
  } catch (e) {
    req.log.error({ e }, "Error marking notification");
    res.status(500).json({ error: "Failed to mark notification" });
  }
});

router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.userId!));
    res.json({ success: true });
  } catch (e) {
    req.log.error({ e }, "Error marking all notifications");
    res.status(500).json({ error: "Failed to mark all notifications" });
  }
});

export default router;
