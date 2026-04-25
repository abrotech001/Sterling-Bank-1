import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Vault, Lock, Unlock, TrendingUp, Sparkles, Calendar, Briefcase,
  ArrowRight, ShieldCheck, AlertTriangle, CheckCircle2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";

type Vault = {
  id: number;
  amount: string;
  durationDays: number;
  ratePct: string;
  expectedReward: string;
  status: "active" | "completed" | "withdrawn_early";
  startDate: string;
  maturityDate: string;
  completedAt?: string | null;
  earlyWithdrawnAt?: string | null;
  createdAt: string;
};

type VaultListResponse = {
  vaults: Vault[];
  summary: {
    totalLocked: string;
    totalExpectedReward: string;
    totalEarned: string;
    activeCount: number;
    completedCount: number;
  };
  rates: Record<string, number>;
};

const DURATIONS = [
  { days: 7, label: "7 days", rate: 0.75 },
  { days: 30, label: "30 days", rate: 2 },
  { days: 90, label: "90 days", rate: 5 },
  { days: 365, label: "365 days", rate: 8 },
];

const INVESTMENT_TYPES = [
  { value: "stocks", label: "Stocks" },
  { value: "shares", label: "Company Shares" },
  { value: "portfolio", label: "Portfolio Management" },
  { value: "other", label: "Other" },
];

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { d, h, m, s, done: ms === 0, ms };
}

function VaultCard({ vault, onWithdraw }: { vault: Vault; onWithdraw: (id: number) => void }) {
  const { d, h, m, s, done } = useCountdown(vault.maturityDate);
  const start = new Date(vault.startDate).getTime();
  const end = new Date(vault.maturityDate).getTime();
  const total = Math.max(1, end - start);
  const elapsed = Math.min(total, Date.now() - start);
  const progress = (elapsed / total) * 100;
  const principal = parseFloat(vault.amount);
  const reward = parseFloat(vault.expectedReward);

  if (vault.status !== "active") {
    const completed = vault.status === "completed";
    return (
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-1.5">
              {completed ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <X className="w-4 h-4 text-destructive" />}
              <span className="text-xs font-bold uppercase tracking-wide">
                {completed ? "Matured" : "Closed early"}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {vault.durationDays} days · {parseFloat(vault.ratePct).toFixed(2)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-base sm:text-lg font-bold">{formatCurrency(principal)}</div>
            <div className={`text-xs ${completed ? "text-primary" : "text-muted-foreground"}`}>
              {completed ? `+${formatCurrency(reward)} earned` : "Reward forfeited"}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {completed && vault.completedAt && `Matured ${new Date(vault.completedAt).toLocaleDateString()}`}
          {!completed && vault.earlyWithdrawnAt && `Closed ${new Date(vault.earlyWithdrawnAt).toLocaleDateString()}`}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 rounded-2xl p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wide text-primary">Active vault</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {vault.durationDays} days · {parseFloat(vault.ratePct).toFixed(2)}% return
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg sm:text-xl font-bold tracking-tight">{formatCurrency(principal)}</div>
          <div className="text-xs text-primary">+{formatCurrency(reward)} expected</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {[
          { v: d, l: "days" },
          { v: h, l: "hrs" },
          { v: m, l: "min" },
          { v: s, l: "sec" },
        ].map(({ v, l }) => (
          <div key={l} className="bg-background/60 rounded-lg p-1.5 text-center">
            <div className="text-base sm:text-lg font-mono font-bold tabular-nums">{String(v).padStart(2, "0")}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{l}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1 mb-3">
        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Started {new Date(vault.startDate).toLocaleDateString()}</span>
          <span>Matures {new Date(vault.maturityDate).toLocaleDateString()}</span>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" disabled={done}>
            <Unlock className="w-3 h-3" />
            {done ? "Maturing…" : "Withdraw early"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Cancel this vault?
            </DialogTitle>
            <DialogDescription className="text-sm">
              You'll forfeit your <span className="font-semibold text-foreground">{formatCurrency(reward)}</span> reward and a 2% early-exit penalty
              (<span className="font-semibold text-foreground">{formatCurrency(principal * 0.02)}</span>) will be deducted.
              <br /><br />
              You'll receive: <span className="font-bold text-foreground">{formatCurrency(principal * 0.98)}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="destructive" className="w-full sm:w-auto" onClick={() => onWithdraw(vault.id)}>
              Yes, withdraw now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WealthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<VaultListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(30);
  const [investmentType, setInvestmentType] = useState<string>("stocks");

  const fetchData = async () => {
    try {
      const r = await api.get<VaultListResponse>("/vaults");
      setData(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const amt = parseFloat(amount) || 0;
  const selected = DURATIONS.find((d) => d.days === duration)!;
  const expectedReward = useMemo(() => +(amt * (selected.rate / 100)).toFixed(2), [amt, selected]);
  const maturityDate = useMemo(
    () => new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
    [duration]
  );

  const create = async () => {
    if (amt < 10) {
      toast({ title: "Minimum vault amount is $10", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await api.post("/vaults", { amount: amt, durationDays: duration });
      toast({
        title: "Savings vault created",
        description: `${formatCurrency(amt)} locked for ${duration} days. Expected reward: ${formatCurrency(expectedReward)}.`,
      });
      setAmount("");
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create vault";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const earlyWithdraw = async (id: number) => {
    try {
      const r = await api.post<{ success: boolean; refund: string; penalty: string; message: string }>(
        `/vaults/${id}/withdraw-early`, {}
      );
      toast({ title: "Vault closed", description: r.message });
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to withdraw";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const messageAdvisor = () => {
    const typeLabel = INVESTMENT_TYPES.find((t) => t.value === investmentType)?.label ?? "Stocks";
    const message =
`Hello, I am interested in investment opportunities. I would like guidance on:
- Stocks
- Company Shares
- Portfolio Growth
- Other Investment Options

Specifically, I'd like to discuss: ${typeLabel}.`;
    navigate(`/support?prefill=${encodeURIComponent(message)}`);
  };

  const active = data?.vaults.filter((v) => v.status === "active") ?? [];
  const finished = data?.vaults.filter((v) => v.status !== "active") ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Wealth</h1>
          <p className="text-sm text-muted-foreground">Grow your money with Savings Vaults and our private investment desk</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <SummaryStat
            icon={<Lock className="w-4 h-4 text-primary" />}
            label="Locked"
            value={loading ? "—" : formatCurrency(data?.summary.totalLocked ?? "0")}
            tone="primary"
          />
          <SummaryStat
            icon={<Sparkles className="w-4 h-4 text-amber-400" />}
            label="Expected reward"
            value={loading ? "—" : formatCurrency(data?.summary.totalExpectedReward ?? "0")}
            tone="default"
          />
          <SummaryStat
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            label="Lifetime earned"
            value={loading ? "—" : formatCurrency(data?.summary.totalEarned ?? "0")}
            tone="primary"
          />
          <SummaryStat
            icon={<Vault className="w-4 h-4 text-blue-400" />}
            label="Active vaults"
            value={loading ? "—" : `${data?.summary.activeCount ?? 0}`}
            sub={data ? `${data.summary.completedCount} completed` : ""}
            tone="default"
          />
        </div>

        <div className="grid lg:grid-cols-5 gap-3 lg:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 bg-card border border-border rounded-2xl p-4 sm:p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Vault className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Create Savings Vault</h3>
                <p className="text-[11px] text-muted-foreground">Lock funds and earn a fixed return at maturity</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount to save</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="10"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-10 pl-8"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Minimum $10. Funds will be moved from your available balance.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Duration & rate</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.days}
                      onClick={() => setDuration(d.days)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        duration === d.days
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-background hover:border-primary/30"
                      }`}
                    >
                      <div className="text-sm font-bold">{d.label}</div>
                      <div className={`text-[11px] mt-0.5 ${duration === d.days ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {d.rate}% return
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">You lock</span>
                  <span className="font-semibold">{formatCurrency(amt)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold">{selected.label}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-semibold text-primary">{selected.rate}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Maturity date</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {maturityDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div className="border-t border-border pt-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expected reward</span>
                  <span className="font-bold text-primary">+{formatCurrency(expectedReward)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payout at maturity</span>
                  <span className="font-bold">{formatCurrency(amt + expectedReward)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Funds are locked until maturity. Early withdrawal forfeits all rewards and applies a 2% penalty.
                </p>
              </div>

              <Button onClick={create} disabled={creating || amt < 10} className="w-full h-10 gap-2">
                <Lock className="w-4 h-4" />
                {creating ? "Creating vault…" : "Create Savings Vault"}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-2 bg-gradient-to-br from-card to-primary/5 border border-border rounded-2xl p-4 sm:p-5 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Private Investment Desk</h3>
                <p className="text-[11px] text-muted-foreground">By appointment only</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground mb-3 leading-snug">
              Access exclusive investment opportunities by speaking with your account manager or financial advisor.
            </p>

            <div className="space-y-2 mb-3">
              <Label className="text-xs">I'd like guidance on</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {INVESTMENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setInvestmentType(t.value)}
                    className={`p-2 rounded-lg border text-left text-xs transition-all ${
                      investmentType === t.value
                        ? "border-amber-400/60 bg-amber-500/10 text-foreground"
                        : "border-border bg-background hover:border-amber-400/30 text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-background/60 border border-border rounded-xl p-2.5 mb-3">
              <p className="text-[11px] text-muted-foreground italic leading-snug">
                "Hello, I am interested in investment opportunities. I would like guidance on Stocks, Company Shares, Portfolio Growth, and Other Investment Options…"
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">You can edit the message before sending.</p>
            </div>

            <Button onClick={messageAdvisor} variant="outline" className="w-full h-10 gap-2 border-amber-400/40 hover:bg-amber-500/10 mt-auto">
              <Briefcase className="w-4 h-4 text-amber-400" />
              Contact Advisor
              <ArrowRight className="w-3.5 h-3.5 ml-auto" />
            </Button>
          </motion.div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" /> Active Vaults
              <span className="text-xs text-muted-foreground font-normal">({active.length})</span>
            </h3>
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
            </div>
          ) : active.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
              <Vault className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No active vaults yet. Create one above to start earning.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence>
                {active.map((v) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <VaultCard vault={v} onWithdraw={earlyWithdraw} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {finished.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Completed Vaults
              <span className="text-xs text-muted-foreground font-normal">({finished.length})</span>
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {finished.map((v) => (
                <VaultCard key={v.id} vault={v} onWithdraw={earlyWithdraw} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryStat({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "primary" | "default";
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-base sm:text-lg font-bold tracking-tight ${tone === "primary" ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
