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
      const data = await api.get<Notification[] | { notifications: Notification[] }>("/notifications");
      const list = Array.isArray(data) ? data : (data?.notifications ?? []);
      setNotifications(list);
      setUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifications([]);
      setUnread(0);
    }
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
