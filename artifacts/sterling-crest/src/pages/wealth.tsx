import { motion } from "framer-motion";
import { TrendingUp, PieChart, ShieldCheck, Briefcase, Sparkles } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const performanceData = Array.from({ length: 12 }, (_, i) => {
  const base = 100 + i * 1.6 + Math.sin(i / 1.5) * 2;
  return { month: ["J","F","M","A","M","J","J","A","S","O","N","D"][i], value: parseFloat(base.toFixed(2)) };
});

const allocations = [
  { name: "Equities", pct: 42, color: "bg-primary" },
  { name: "Fixed Income", pct: 28, color: "bg-blue-500" },
  { name: "Alternatives", pct: 18, color: "bg-amber-500" },
  { name: "Cash & Equivalents", pct: 12, color: "bg-emerald-500" },
];

export default function WealthPage() {
  const [, navigate] = useLocation();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Wealth Management</h1>
            <p className="text-muted-foreground">Curated portfolios, advised by humans, monitored 24/7.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/support")}>Schedule consultation</Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-5 lg:p-6"
        >
          <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Indicative Strategy YTD</div>
              <div className="text-3xl font-bold mt-1">+18.4%</div>
              <div className="text-xs text-emerald-500 font-medium mt-1">↑ 2.1% vs benchmark</div>
            </div>
            <div className="flex gap-2">
              {["1M", "3M", "1Y", "ALL"].map((p, i) => (
                <button
                  key={p}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                    i === 2 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-48 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#wealthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Recommended Allocation</h3>
            </div>
            <div className="space-y-3">
              {allocations.map((a) => (
                <div key={a.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>{a.name}</span>
                    <span className="font-medium">{a.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${a.pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-full ${a.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Your dedicated advisor</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Crestfield Premier members receive 1:1 access to a CFA-certified portfolio manager.
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">CB</div>
              <div>
                <div className="text-sm font-medium">Caroline Bennett, CFA</div>
                <div className="text-xs text-muted-foreground">Senior Portfolio Manager</div>
              </div>
            </div>
            <Button className="w-full" onClick={() => navigate("/support")}>Message advisor</Button>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: TrendingUp, label: "Tactical rebalancing" },
            { icon: ShieldCheck, label: "SIPC protected" },
            { icon: Sparkles, label: "Tax-loss harvesting" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50">
              <f.icon className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
