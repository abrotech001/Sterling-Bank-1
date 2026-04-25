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
import { CrestfieldLogo } from "@/components/brand/logo";

function UserAvatar({
  src, firstName, lastName, size = "md", onClick,
}: {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  size?: "sm" | "md";
  onClick?: () => void;
}) {
  const cls = size === "sm"
    ? "w-8 h-8 text-xs"
    : "w-9 h-9 text-sm";
  const base = `${cls} rounded-full overflow-hidden flex-shrink-0 ${onClick ? "cursor-pointer hover:opacity-90" : ""}`;
  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName ?? ""} ${lastName ?? ""}`}
        className={`${base} object-cover bg-card border border-border`}
        onClick={onClick}
      />
    );
  }
  return (
    <div
      onClick={onClick}
      className={`${base} bg-primary/20 flex items-center justify-center text-primary font-bold`}
    >
      {firstName?.[0]}{lastName?.[0]}
    </div>
  );
}

const navSections: { title: string; items: { icon: typeof LayoutDashboard; label: string; path: string }[] }[] = [
  {
    title: "Banking",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: ArrowLeftRight, label: "Transfer", path: "/transfer" },
      { icon: Download, label: "Deposit", path: "/deposit" },
      { icon: Upload, label: "Withdraw", path: "/withdraw" },
      { icon: Gift, label: "Gift Cards", path: "/giftcards" },
      { icon: CreditCard, label: "Cards", path: "/cards" },
      { icon: FileText, label: "Transactions", path: "/transactions" },
    ],
  },
  {
    title: "Account",
    items: [
      { icon: Shield, label: "KYC Verification", path: "/kyc" },
      { icon: MessageCircle, label: "Live Support", path: "/support" },
      { icon: Settings, label: "Settings", path: "/settings" },
    ],
  },
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
          <CrestfieldLogo size={36} className="flex-shrink-0" />
          <div>
            <div className="font-bold text-sm leading-tight">Crestfield Bank</div>
            <div className="text-xs text-muted-foreground leading-tight">Private Banking</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        {navSections.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && "mt-5")}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              {section.title}
            </div>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const active = location === item.path || location.startsWith(item.path + "/");
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    className={cn(
                      "group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden",
                      active
                        ? "text-primary-foreground bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 ring-1 ring-primary/40"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 hover:translate-x-0.5"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary-foreground/80" />
                    )}
                    <item.icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0 transition-transform duration-200",
                        active ? "scale-110" : "group-hover:scale-105"
                      )}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.label === "Notifications" && unread > 0 && (
                      <Badge className="h-5 px-1.5 text-xs">{unread}</Badge>
                    )}
                    {active && <ChevronRight className="w-3 h-3 opacity-80" />}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-1">
          <UserAvatar
            src={user?.profileImage}
            firstName={user?.firstName}
            lastName={user?.lastName}
            size="md"
          />
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

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 min-w-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-card flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden flex items-center gap-2 min-w-0 flex-1 justify-center">
            <CrestfieldLogo size={22} className="flex-shrink-0" />
            <span className="font-bold text-sm truncate">Crestfield Bank</span>
          </div>
          <div className="hidden lg:block flex-1" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => navigate("/notifications")}>
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
              )}
            </Button>
            <UserAvatar
              src={user?.profileImage}
              firstName={user?.firstName}
              lastName={user?.lastName}
              size="sm"
              onClick={() => navigate("/settings")}
            />
          </div>
        </header>

        <main className="flex-1 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5 pb-20 lg:pb-5 min-w-0 w-full">
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
