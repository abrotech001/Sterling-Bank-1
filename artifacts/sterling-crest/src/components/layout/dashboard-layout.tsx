import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, Download, Upload,
  Gift, FileText, Bell, Settings, LogOut, MessageCircle, Shield, Menu, X, ChevronRight,
  Home, Landmark, TrendingUp, Award, User
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: ArrowLeftRight, label: "Transfer", path: "/transfer" },
  { icon: Download, label: "Deposit", path: "/deposit" },
  { icon: Upload, label: "Withdraw", path: "/withdraw" },
  { icon: Gift, label: "Gift Cards", path: "/giftcards" },
  { icon: CreditCard, label: "Cards", path: "/cards" },
  { icon: FileText, label: "Transactions", path: "/transactions" },
  { icon: Shield, label: "Tier Verification", path: "/kyc" },
  { icon: MessageCircle, label: "Live Support", path: "/support" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { unread } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Crestfield</div>
            <div className="text-xs text-muted-foreground leading-tight">Private Banking</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = location === item.path || location.startsWith(item.path + "/");
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.label === "Notifications" && unread > 0 && (
                  <Badge className="h-5 px-1.5 text-xs">{unread}</Badge>
                )}
                {active && <ChevronRight className="w-3 h-3 opacity-60" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-xs text-muted-foreground truncate">@{user?.username}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 border-r border-border bg-card z-30">
        <NavContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border z-50 lg:hidden flex flex-col"
            >
              <NavContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-card">
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">Crestfield</span>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/notifications")}>
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
              )}
            </Button>
            <div
              className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs cursor-pointer"
              onClick={() => navigate("/settings")}
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      <BottomNav location={location} navigate={navigate} />
    </div>
  );
}

const bottomNavItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Landmark, label: "Loan", path: "/loans" },
  { icon: TrendingUp, label: "Wealth", path: "/wealth" },
  { icon: Award, label: "Reward", path: "/rewards" },
  { icon: User, label: "Me", path: "/settings" },
];

function BottomNav({ location, navigate }: { location: string; navigate: (p: string) => void }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-stretch justify-around px-1 py-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {bottomNavItems.map((item) => {
          const active = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
              <span className={cn("text-[10px] font-medium leading-tight", active && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
