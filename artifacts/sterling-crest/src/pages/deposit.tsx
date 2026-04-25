import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";

const DEPOSIT_METHODS = [
  { id: "wire", label: "Wire Transfer", desc: "Domestic & international bank wire", time: "1-3 business days" },
  { id: "ach", label: "ACH Transfer", desc: "US bank account direct transfer", time: "2-5 business days" },
];

export default function DepositPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState("wire");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard" });
  };

  const submit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/transactions/deposit", { amount: parseFloat(amount), method, description: `${method.toUpperCase()} deposit` });
      setSubmitted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Deposit request failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto pt-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Deposit Initiated</h2>
            <p className="text-sm text-muted-foreground mb-5">Your deposit of <span className="font-semibold text-foreground">{formatCurrency(amount)}</span> has been registered. Please complete the transfer using the instructions provided.</p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setSubmitted(false); setAmount(""); }}>New Deposit</Button>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Deposit Funds</h1>
          <p className="text-sm text-muted-foreground">Add money to your Crestfield account</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {DEPOSIT_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                method === m.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="font-semibold text-sm">{m.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{m.desc}</div>
              <div className="text-[10px] text-primary mt-1 font-medium">{m.time}</div>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Deposit Amount (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input type="number" step="0.01" min="1" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 pl-8" />
            </div>
            {amount && parseFloat(amount) > 0 && (
              <p className="text-xs text-muted-foreground">Amount: <span className="font-medium text-foreground">{formatCurrency(amount)}</span></p>
            )}
          </div>

          <div className="bg-background border border-border rounded-xl p-3 sm:p-4 space-y-2.5">
            <p className="text-sm font-medium flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              {method === "wire" ? "Wire Transfer Instructions" : "ACH Transfer Instructions"}
            </p>
            {[
              ["Bank Name", "Crestfield Bank"],
              ["Account Name", `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.username || "—"],
              ["Account Number", user?.accountNumber ?? ""],
              ["Routing Number", "026009593"],
              ...(method === "wire" ? [["SWIFT/BIC", "SCBKUS33"]] : []),
              ["Reference", `DEP-${user?.id}`],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono font-medium truncate">{val}</span>
                  <button onClick={() => copy(val)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full h-11" onClick={submit} disabled={loading || !amount}>
            {loading ? "Processing..." : "Submit Deposit Request"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
