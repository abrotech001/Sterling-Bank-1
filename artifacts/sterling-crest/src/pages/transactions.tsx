import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CheckCircle2, Clock, XCircle, AlertCircle, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { api } from "@/lib/api";

type Tx = {
  id: number; type: string; amount: string; currency: string;
  status: string; description: string; createdAt: string;
  counterpartyName?: string; counterpartyAccount?: string;
  metadata?: Record<string, unknown>;
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

const typeColor = (type: string) => {
  if (type === "deposit") return "text-primary";
  if (type === "withdrawal") return "text-destructive";
  return "text-blue-400";
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal" | "transfer">("all");

  useEffect(() => {
    api.get<{ transactions: Tx[] }>("/transactions?limit=50")
      .then((r) => setTransactions(r.transactions))
      .finally(() => setLoading(false));
  }, []);

  const filtered = transactions.filter((tx) => {
    const matchesFilter = filter === "all" || tx.type === filter;
    const matchesSearch = !search ||
      tx.description?.toLowerCase().includes(search.toLowerCase()) ||
      tx.counterpartyName?.toLowerCase().includes(search.toLowerCase()) ||
      tx.amount.includes(search);
    return matchesFilter && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Your full transaction history</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "deposit", "withdrawal", "transfer"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="capitalize h-10"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Filter className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-4 p-4 hover:bg-background transition-colors"
                >
                  <div className="w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center flex-shrink-0">
                    {txIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {tx.description || tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className={`capitalize font-medium ${typeColor(tx.type)}`}>{tx.type}</span>
                      <span>•</span>
                      <span>{new Date(tx.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(tx.status)}
                      <span className="text-xs text-muted-foreground capitalize">{tx.status}</span>
                    </div>
                    <div className={`font-semibold text-sm ${tx.type === "deposit" ? "text-primary" : ""}`}>
                      {tx.type === "deposit" ? "+" : "-"}${parseFloat(tx.amount).toFixed(2)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
