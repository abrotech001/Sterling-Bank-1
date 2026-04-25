import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CheckCircle2, Clock,
  XCircle, AlertCircle, Filter, TrendingUp, TrendingDown, Calendar
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type Tx = {
  id: number;
  type: string;
  amount: number;
  status: string;
  note?: string | null;
  description?: string | null;
  createdAt: string;
  direction: "incoming" | "outgoing";
  label: string;
  counterpartyName?: string | null;
  counterpartyAccount?: string | null;
};

const MONTH_NAMES = [
  "All months", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const statusBadge = (s: string) => {
  if (s === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
  if (s === "pending") return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
  if (s === "failed" || s === "rejected") return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />;
};

const txIcon = (tx: Tx) => {
  if (tx.direction === "incoming") return <ArrowDownLeft className="w-4 h-4 text-primary" />;
  return <ArrowUpRight className="w-4 h-4 text-destructive" />;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal" | "transfer" | "gift_card" | "admin_fund">("all");

  const now = new Date();
  const [year, setYear] = useState<number | "all">(now.getFullYear());
  const [month, setMonth] = useState<number>(0);

  useEffect(() => {
    api
      .get<{ transactions: Tx[] }>("/transactions?limit=200")
      .then((r) => setTransactions(r.transactions))
      .finally(() => setLoading(false));
  }, []);

  const yearsAvailable = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    transactions.forEach((t) => set.add(new Date(t.createdAt).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions, now]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const date = new Date(tx.createdAt);
      const matchesType = filter === "all" || tx.type === filter;
      const matchesYear = year === "all" || date.getFullYear() === year;
      const matchesMonth = month === 0 || date.getMonth() + 1 === month;
      const text = `${tx.note ?? ""} ${tx.counterpartyName ?? ""} ${tx.amount}`.toLowerCase();
      const matchesSearch = !search || text.includes(search.toLowerCase());
      return matchesType && matchesYear && matchesMonth && matchesSearch;
    });
  }, [transactions, filter, year, month, search]);

  const summary = useMemo(() => {
    let received = 0;
    let sent = 0;
    let received_pending = 0;
    let sent_pending = 0;
    filtered.forEach((tx) => {
      if (tx.status === "failed" || tx.status === "rejected") return;
      const isPending = tx.status === "pending";
      if (tx.direction === "incoming") {
        if (isPending) received_pending += tx.amount;
        else received += tx.amount;
      } else {
        if (isPending) sent_pending += tx.amount;
        else sent += tx.amount;
      }
    });
    return { received, sent, received_pending, sent_pending, count: filtered.length };
  }, [filtered]);

  const periodLabel =
    year === "all"
      ? "All time"
      : month === 0
      ? `${year}`
      : `${MONTH_NAMES[month]} ${year}`;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">Your full transaction history</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <SummaryCard
            icon={<TrendingUp className="w-4 h-4 text-primary" />}
            label="Received"
            value={formatCurrency(summary.received)}
            sub={summary.received_pending > 0 ? `+${formatCurrency(summary.received_pending)} pending` : null}
            tone="primary"
          />
          <SummaryCard
            icon={<TrendingDown className="w-4 h-4 text-destructive" />}
            label="Sent"
            value={formatCurrency(summary.sent)}
            sub={summary.sent_pending > 0 ? `${formatCurrency(summary.sent_pending)} pending` : null}
            tone="destructive"
          />
          <SummaryCard
            icon={<ArrowLeftRight className="w-4 h-4 text-blue-400" />}
            label="Net"
            value={formatCurrency(summary.received - summary.sent)}
            sub={periodLabel}
            tone="default"
          />
          <SummaryCard
            icon={<Filter className="w-4 h-4 text-muted-foreground" />}
            label="Total entries"
            value={summary.count.toString()}
            sub={periodLabel}
            tone="default"
          />
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="relative sm:col-span-1">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="h-9 pl-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Select value={year.toString()} onValueChange={(v) => setYear(v === "all" ? "all" : parseInt(v))}>
                <SelectTrigger className="h-9 pl-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {yearsAvailable.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                ["all", "All"],
                ["transfer", "Transfers"],
                ["deposit", "Deposits"],
                ["withdrawal", "Withdrawals"],
                ["gift_card", "Gift Cards"],
                ["admin_fund", "Credits"],
              ] as const
            ).map(([f, label]) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="h-7 px-2.5 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-3 space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Filter className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No transactions found for {periodLabel}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3) }}
                  className="flex items-center gap-3 p-3 hover:bg-background transition-colors"
                >
                  <div className="w-9 h-9 rounded-full border border-border bg-background flex items-center justify-center flex-shrink-0">
                    {txIcon(tx)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        tx.direction === "incoming" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                      }`}>
                        {tx.label}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {tx.type.replace("_", " ")}
                      </span>
                    </div>
                    <div className="font-medium text-sm truncate mt-0.5">
                      {tx.counterpartyName || tx.note || "Transaction"}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{new Date(tx.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                      <span>•</span>
                      <span>{new Date(tx.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      {tx.note && tx.counterpartyName && (
                        <>
                          <span>•</span>
                          <span className="truncate">{tx.note}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className={`font-semibold text-sm ${tx.direction === "incoming" ? "text-primary" : "text-foreground"}`}>
                      {tx.direction === "incoming" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </div>
                    <div className="flex items-center gap-1">
                      {statusBadge(tx.status)}
                      <span className="text-[10px] text-muted-foreground capitalize">{tx.status}</span>
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

function SummaryCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string | null;
  tone: "primary" | "destructive" | "default";
}) {
  const valueColor = tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-base sm:text-lg font-bold tracking-tight ${valueColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
