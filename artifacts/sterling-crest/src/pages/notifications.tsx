import { motion } from "framer-motion";
import { Bell, CheckCheck, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const typeIcon = (type: string) => {
  if (type === "success") return <CheckCircle2 className="w-5 h-5 text-primary" />;
  if (type === "warning") return <AlertCircle className="w-5 h-5 text-yellow-400" />;
  if (type === "error") return <AlertCircle className="w-5 h-5 text-destructive" />;
  return <Info className="w-5 h-5 text-blue-400" />;
};

export default function NotificationsPage() {
  const { notifications, markRead } = useNotifications();

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">Stay up to date with your account activity</p>
          </div>
          {notifications.some((n) => !n.isRead) && (
            <Button variant="outline" size="sm" onClick={() => notifications.filter(n => !n.isRead).forEach(n => markRead(n.id))}>
              <CheckCheck className="w-4 h-4 mr-1.5" /> Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {notifications.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-start gap-4 p-4 hover:bg-background transition-colors cursor-pointer",
                  !n.isRead && "bg-primary/5"
                )}
                onClick={() => { if (!n.isRead) markRead(n.id); }}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {typeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-medium", !n.isRead && "text-foreground")}>{n.title}</p>
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
