import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, TrendingUp,
  Eye, EyeOff, Plus, Clock, CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { onWSMessage } from "@/lib/websocket";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

type WalletData = { balance: string; pendingBalance: string; currency: string };
type TxItem = {
  id: number; type: string; amount: string; currency: string;
  status: string; description: string; createdAt: string;
  counterpartyName?: string;
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

const statusIcon = (s: string) => {
  if (s === "completed") return <CheckCircle2 className="w-4 h-4 text-primary" />;
  if (s === "pending") return <Clock className="w-4 h-4 text-yellow-400" />;
  if (s === "failed" || s === "rejected") return <XCircle className="w-4 h-4 text-destructive" />;
  return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
};

const txIcon = (type: string) => {
  if (type === "deposit") return <ArrowDownLeft className="w-4 h-4 text-primary" />;
  if (type === "withdrawal") return <ArrowUpRight className="w-4 h-4 text-destructive" />;
  return <ArrowLeftRight className="w-4 h-4 text-blue-400" />;
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
    .slice(0, 7)
    .reverse()
    .map((t, i) => ({
      name: new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: parseFloat(t.amount),
      i,
    }));

  const fetchData = async () => {
    try {
      const [walletData, txRes] = await Promise.all([
        api.get<WalletData | { wallet: WalletData }>("/wallet"),
        api.get<{ transactions: TxItem[] }>("/transactions?limit=5"),
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

  const balance = wallet ? parseFloat(wallet.balance).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "$0.00";
  const pending = wallet ? parseFloat(wallet.pendingBalance).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "$0.00";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <h1 className="text-2xl font-bold">Good morning, {user?.firstName} 👋</h1>
          <p className="text-muted-foreground mt-0.5">Here's your financial overview</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp} className="md:col-span-2">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                  {loading ? (
                    <Skeleton className="h-10 w-48" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <h2 className="text-4xl font-bold tracking-tight">
                        {balanceVisible ? balance : "••••••"}
                      </h2>
                      <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-muted-foreground hover:text-foreground">
                        {balanceVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  )}
                  {!loading && wallet && (
                    <p className="text-sm text-muted-foreground mt-1">Pending: {pending}</p>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">{user?.accountNumber}</div>
                  <div>Account No.</div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button size="sm" onClick={() => navigate("/transfer")} className="gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/deposit")} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Deposit
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/withdraw")} className="gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp} className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">KYC Status</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Level {user?.kycLevel ?? 0} / 2
              </div>
              <div className="mt-2 w-full bg-border rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${((user?.kycLevel ?? 0) / 2) * 100}%` }}
                />
              </div>
              {(user?.kycLevel ?? 0) < 1 && (
                <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-8" onClick={() => navigate("/kyc")}>
                  Verify Identity
                </Button>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">Quick Actions</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => navigate("/giftcards")} className="text-xs py-2 px-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors text-center">
                  Gift Cards
                </button>
                <button onClick={() => navigate("/cards")} className="text-xs py-2 px-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors text-center">
                  My Cards
                </button>
                <button onClick={() => navigate("/support")} className="text-xs py-2 px-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors text-center">
                  Support
                </button>
                <button onClick={() => navigate("/transactions")} className="text-xs py-2 px-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors text-center">
                  History
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {chartData.length > 0 && (
          <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp}>
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152 69% 31%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(152 69% 31%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217.2 32.6% 17.5%)", borderRadius: "8px", fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Amount"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(152 69% 31%)" strokeWidth={2} fill="url(#colorGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Transactions</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate("/transactions")}>View all</Button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No transactions yet. Make your first transfer!
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-background transition-colors">
                    <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0">
                      {txIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {tx.description || (tx.type === "deposit" ? "Deposit" : tx.type === "withdrawal" ? "Withdrawal" : "Transfer")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusIcon(tx.status)}
                      <div className={`text-sm font-semibold ${tx.type === "deposit" ? "text-primary" : "text-foreground"}`}>
                        {tx.type === "deposit" ? "+" : "-"}${parseFloat(tx.amount).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
