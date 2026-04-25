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
import DashboardLayout from "@/components/layout/dashboard-layout";

const DEPOSIT_METHODS = [
  { id: "wire", label: "Wire Transfer", desc: "Domestic & international bank wire", time: "1-3 business days" },
  { id: "ach", label: "ACH Transfer", desc: "US bank account direct transfer", time: "2-5 business days" },
  { id: "crypto", label: "Cryptocurrency", desc: "Bitcoin, Ethereum, USDC", time: "10-30 minutes" },
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
        <div className="max-w-md mx-auto pt-12">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Deposit Initiated</h2>
            <p className="text-muted-foreground mb-6">Your deposit of ${parseFloat(amount).toFixed(2)} has been registered. Please complete the transfer using the instructions provided.</p>
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
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Deposit Funds</h1>
          <p className="text-muted-foreground">Add money to your Crestfield account</p>
        </div>

        <div className="space-y-3">
          {DEPOSIT_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                method === m.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="font-semibold text-sm">{m.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.desc} • {m.time}</div>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Deposit Amount (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input type="number" step="0.01" min="1" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 pl-8" />
            </div>
          </div>

          {method === "wire" && (
            <div className="bg-background border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Info className="w-4 h-4 text-primary" />Wire Transfer Instructions</p>
              {[
                ["Bank Name", "Crestfield Bank"],
                ["Account Name", `${user?.firstName} ${user?.lastName}`],
                ["Account Number", user?.accountNumber ?? ""],
                ["Routing Number", "026009593"],
                ["SWIFT/BIC", "SCBKUS33"],
                ["Reference", `DEP-${user?.id}`],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium">{val}</span>
                    <button onClick={() => copy(val)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {method === "crypto" && (
            <div className="bg-background border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Info className="w-4 h-4 text-primary" />Crypto Deposit Addresses</p>
              {[
                ["Bitcoin (BTC)", "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"],
                ["Ethereum (ETH)", "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"],
                ["USDC (ERC-20)", "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"],
              ].map(([label, addr]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">{addr.slice(0, 12)}...</span>
                    <button onClick={() => copy(addr)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button className="w-full h-11" onClick={submit} disabled={loading || !amount}>
            {loading ? "Processing..." : "Submit Deposit Request"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
