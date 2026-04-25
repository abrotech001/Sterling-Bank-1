import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Shield,
  Eye, EyeOff, Plus, Clock, CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { onWSMessage } from "@/lib/websocket";
import { formatCurrency } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

type WalletData = { balance: string; pendingBalance: string; currency: string };
type TxItem = {
  id: number; type: string; amount: number;
  status: string; note?: string | null; createdAt: string;
  direction?: "incoming" | "outgoing";
  label?: string;
  counterpartyName?: string | null;
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
};

const statusIcon = (s: string) => {
  if (s === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
  if (s === "pending") return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
  if (s === "failed" || s === "rejected") return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />;
};

const txIcon = (tx: TxItem) => {
  if (tx.direction === "incoming") return <ArrowDownLeft className="w-4 h-4 text-primary" />;
  return <ArrowUpRight className="w-4 h-4 text-destructive" />;
};

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { user, refresh } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const chartData = transactions
    .filter((t) => t.status === "completed")
    .slice(0, 8)
    .reverse()
    .map((t) => ({
      name: new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: t.amount,
    }));

  const fetchData = async () => {
    try {
      const [walletData, txRes] = await Promise.all([
        api.get<WalletData | { wallet: WalletData }>("/wallet"),
        api.get<{ transactions: TxItem[] }>("/transactions?limit=6"),
      ]);
      const walletObj = (walletData as { wallet?: WalletData }).wallet || (walletData as WalletData);
      setWallet({
        balance: String(walletObj.balance),
        pendingBalance: String(walletObj.pendingBalance),
        currency: walletObj.currency,
      });
      setTransactions(txRes.transactions);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    refresh();
    const unsub = onWSMessage((msg) => {
      if (["transaction_update", "balance_update"].includes(msg.type)) fetchData();
    });
    return unsub;
  }, []);

  const balance = wallet ? formatCurrency(wallet.balance) : "$0.00";
  const pending = wallet ? formatCurrency(wallet.pendingBalance) : "$0.00";
  const tier = (user?.kycLevel ?? 0) + 1;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Welcome back, {user?.firstName} 👋</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Here's your financial overview</p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-3 lg:gap-4">
          <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp} className="lg:col-span-2">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Available Balance</p>
                  {loading ? (
                    <Skeleton className="h-9 w-44" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl sm:text-4xl font-bold tracking-tight truncate">
                        {balanceVisible ? balance : "••••••"}
                      </h2>
                      <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                        {balanceVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                  {!loading && wallet && parseFloat(wallet.pendingBalance) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Pending: {pending}</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                  <div className="font-semibold text-foreground font-mono text-[11px] sm:text-xs">{user?.accountNumber}</div>
                  <div className="text-[10px] sm:text-xs">Account No.</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Button size="sm" onClick={() => navigate("/transfer")} className="gap-1 h-9 text-xs">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/deposit")} className="gap-1 h-9 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Deposit
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/withdraw")} className="gap-1 h-9 text-xs">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs sm:text-sm font-medium">Account Tier</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Tier {tier} of Tier 3
              </div>
              <div className="mt-2 w-full bg-border rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${(tier / 3) * 100}%` }}
                />
              </div>
              {(user?.kycLevel ?? 0) < 1 && (
                <Button size="sm" variant="outline" className="w-full mt-2.5 text-xs h-7" onClick={() => navigate("/kyc")}>
                  Verify Identity
                </Button>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs sm:text-sm font-medium">Quick Access</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ["Gift Cards", "/giftcards"],
                  ["My Cards", "/cards"],
                  ["Support", "/support"],
                  ["History", "/transactions"],
                ].map(([label, path]) => (
                  <button key={path} onClick={() => navigate(path)} className="text-[11px] py-1.5 px-2 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors text-center">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-5 gap-3 lg:gap-4">
          {chartData.length > 0 && (
            <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="lg:col-span-3">
              <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
                <h3 className="font-semibold text-sm mb-3">Recent Activity</h3>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152 69% 31%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(152 69% 31%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217.2 32.6% 17.5%)", borderRadius: "8px", fontSize: 11 }}
                      formatter={(v: number) => [formatCurrency(v), "Amount"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="hsl(152 69% 31%)" strokeWidth={2} fill="url(#colorGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp} className={chartData.length > 0 ? "lg:col-span-2" : "lg:col-span-5"}>
            <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 h-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Recent Transactions</h3>
                <Button variant="ghost" size="sm" onClick={() => navigate("/transactions")} className="h-7 text-xs">View all</Button>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No transactions yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {transactions.map((tx) => {
                    const dir = tx.direction ?? (tx.type === "deposit" || tx.type === "admin_fund" || tx.type === "gift_card" ? "incoming" : "outgoing");
                    return (
                      <div key={tx.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-background transition-colors">
                        <div className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0">
                          {txIcon({ ...tx, direction: dir })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm font-medium truncate">
                            {tx.counterpartyName || tx.note || (tx.label ?? (dir === "incoming" ? "Received" : "Sent"))}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1">
                            <span className={`text-[9px] font-bold uppercase ${
                              tx.status === "pending" ? "text-yellow-500" :
                              tx.status === "failed" || tx.status === "rejected" ? "text-destructive" :
                              dir === "incoming" ? "text-primary" : "text-destructive"
                            }`}>
                              {tx.status === "pending" ? "PENDING" :
                                tx.status === "failed" || tx.status === "rejected" ? tx.status.toUpperCase() :
                                (tx.label ?? (dir === "incoming" ? "Received" : "Sent"))}
                            </span>
                            <span>•</span>
                            <span>{new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <div className={`text-xs sm:text-sm font-semibold ${dir === "incoming" ? "text-primary" : "text-foreground"}`}>
                            {dir === "incoming" ? "+" : "-"}{formatCurrency(tx.amount)}
                          </div>
                          {statusIcon(tx.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
