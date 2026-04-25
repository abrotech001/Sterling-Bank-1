import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { onWSMessage } from "@/lib/websocket";

export type Notification = {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const fetchNotifications = async () => {
    try {
      const data = await api.get<{ notifications: Notification[] }>("/notifications");
      setNotifications(data.notifications);
      setUnread(data.notifications.filter((n) => !n.isRead).length);
    } catch {}
  };

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const unsub = onWSMessage((msg) => {
      if (msg.type === "notification") {
        fetchNotifications();
      }
    });
    return unsub;
  }, []);

  return { notifications, unread, markRead, refresh: fetchNotifications };
}
