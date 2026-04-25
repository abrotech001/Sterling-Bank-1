import { motion } from "framer-motion";
import { Award, Gift, Plane, ShoppingBag, Coffee, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const tiers = [
  { name: "Silver", min: 0, perks: ["1x points on all spend", "Standard support"] },
  { name: "Gold", min: 50000, perks: ["2x points", "Priority support", "Free wires"] },
  { name: "Platinum", min: 250000, perks: ["3x points", "Dedicated banker", "Lounge access"] },
];

const offers = [
  { icon: Plane, title: "5,000 bonus miles", brand: "Crestfield Travel", color: "from-sky-500/20 to-sky-500/5", iconColor: "text-sky-400" },
  { icon: ShoppingBag, title: "10% back at premium retailers", brand: "Curated brands", color: "from-rose-500/20 to-rose-500/5", iconColor: "text-rose-400" },
  { icon: Coffee, title: "Buy 5, get 1 free", brand: "Specialty cafés", color: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-400" },
  { icon: Gift, title: "$25 statement credit", brand: "Fine dining", color: "from-violet-500/20 to-violet-500/5", iconColor: "text-violet-400" },
];

export default function RewardsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const points = 0;
  const currentTier = tiers[0];
  const nextTier = tiers[1];
  const progress = nextTier ? Math.min(100, (points / nextTier.min) * 100) : 100;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Rewards</h1>
            <p className="text-muted-foreground">Earn on every transaction. Redeem for what matters.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/giftcards")}>Browse gift cards</Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-2xl border border-border p-6 lg:p-8"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--card)) 60%)",
          }}
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="relative grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary mb-3">
                <Award className="w-3.5 h-3.5" />
                {currentTier.name} Member
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Reward Points</div>
              <div className="text-4xl lg:text-5xl font-bold tracking-tight mt-1">
                {points.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Hello, {user?.firstName || "Member"} — start earning by using your card.
              </div>
            </div>
            <div>
              {nextTier && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Progress to {nextTier.name}</span>
                    <span>{points.toLocaleString()} / {nextTier.min.toLocaleString()}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary to-primary/70"
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button variant="secondary" onClick={() => navigate("/cards")}>Use a card</Button>
                <Button onClick={() => navigate("/giftcards")}>Redeem</Button>
              </div>
            </div>
          </div>
        </motion.div>

        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-3">Featured offers</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {offers.map((o, i) => (
              <motion.div
                key={o.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className={`rounded-2xl border border-border bg-gradient-to-br ${o.color} p-4 flex items-start gap-3`}
              >
                <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0">
                  <o.icon className={`w-5 h-5 ${o.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{o.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{o.brand}</div>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-primary/60" />
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-3">Membership tiers</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {tiers.map((t, i) => {
              const isCurrent = t.name === currentTier.name;
              return (
                <div
                  key={t.name}
                  className={`rounded-2xl border p-5 ${
                    isCurrent ? "border-primary/60 bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {i === 0 ? "Standard" : `From $${t.min.toLocaleString()}`}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {t.perks.map((p) => (
                      <li key={p} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
