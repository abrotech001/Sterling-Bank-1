import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { ArrowLeftRight, CheckCircle2, AlertCircle, Loader2, UserCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/dashboard-layout";

type TransferForm = {
  toAccountNumber: string;
  amount: string;
  description: string;
  pin: string;
};

type Recipient = {
  accountNumber: string;
  fullName: string;
  username: string;
};

export default function TransferPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
    const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState<number | null>(null);
  const [sentAmount, setSentAmount] = useState<string>("0");


  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<TransferForm>();
  const accountNumber = watch("toAccountNumber");

  useEffect(() => {
    setRecipient(null);
    setLookupError(null);
    const acct = (accountNumber || "").trim();
    if (acct.length < 6) return;
    const timer = setTimeout(async () => {
      setLookingUp(true);
      try {
        const res = await api.get<{ recipient: Recipient }>(`/transactions/lookup-recipient/${encodeURIComponent(acct)}`);
        setRecipient(res.recipient);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Account not found";
        setLookupError(msg);
      } finally {
        setLookingUp(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [accountNumber]);

  const onSubmit = async (data: TransferForm) => {
    if (!recipient) {
      toast({ title: "Verify recipient first", description: "Enter a valid Crestfield account number.", variant: "destructive" });
      return;
    }
    if (!data.description?.trim()) {
      toast({ title: "Narration required", description: "Please enter a transaction note.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ message: string; transaction: { id: number }; transactionId?: number }>(
        "/transactions/transfer",
        {
          toAccountNumber: data.toAccountNumber.trim(),
          amount: parseFloat(data.amount),
          note: data.description.trim(),
          pin: data.pin || undefined,
        }
      );
      setTxId(res.transaction?.id ?? res.transactionId ?? null);
      setSentAmount(data.amount);
      setSuccess(true);
      reset();
      setRecipient(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transfer failed";
      toast({ title: "Transfer failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

    if (success) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto pt-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-[2rem] p-8 text-center shadow-sm"
          >
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Sent</h2>
            
            <p className="text-lg text-foreground mb-1">
              Your payment of <span className="font-bold">{formatCurrency(parseFloat(sentAmount))}</span> is on its way.
            </p>
            
            <p className="text-sm text-muted-foreground mb-8">
              It may take a short time to arrive to the recipient.
            </p>
            
            {txId !== null && (
              <div className="bg-muted/50 rounded-2xl p-4 mb-8 border border-border flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receipt ID</span>
                <span className="text-sm font-mono font-medium text-foreground">#{txId}</span>
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-semibold" 
                onClick={() => navigate("/dashboard")}
              >
                Done
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground hover:text-foreground rounded-xl h-12" 
                onClick={() => { setSuccess(false); setTxId(null); }}
              >
                Send Another Transfer
              </Button>
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
          <h1 className="text-2xl font-bold">Internal Transfer</h1>
          <p className="text-muted-foreground">Transfer funds to another Crestfield account</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 p-3 bg-primary/10 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Available balance: <span className="font-semibold text-foreground">{formatCurrency(user?.wallet?.balance ?? 0)}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Recipient Account Number</Label>
              <Input
                placeholder="SCB-XXXXXXXXXX"
                {...register("toAccountNumber", { required: "Account number is required" })}
                className="h-11 font-mono"
                autoComplete="off"
              />
              {errors.toAccountNumber && <p className="text-xs text-destructive">{errors.toAccountNumber.message}</p>}

              {lookingUp && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Looking up recipient…
                </div>
              )}
              {!lookingUp && recipient && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-primary/10 border border-primary/30"
                >
                  <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold text-foreground">{recipient.fullName}</div>
                    <div className="text-xs text-muted-foreground">@{recipient.username} · {recipient.accountNumber}</div>
                  </div>
                </motion.div>
              )}
              {!lookingUp && lookupError && accountNumber && accountNumber.trim().length >= 6 && (
                <p className="text-xs text-destructive mt-1">{lookupError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...register("amount", {
                    required: "Amount is required",
                    min: { value: 0.01, message: "Minimum $0.01" },
                  })}
                  className="h-11 pl-8"
                />
              </div>
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Narration / Description <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="e.g. Rent for May, business payment, gift to family..."
                {...register("description", { required: "Narration is required" })}
                className="resize-none h-20"
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
              <p className="text-xs text-muted-foreground">This note will appear in your transaction history and the recipient's.</p>
            </div>

            {user?.hasPin ? (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Transaction Passcode
                </Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••"
                  {...register("pin", { required: "Passcode is required" })}
                  className="h-11 font-mono tracking-widest"
                />
                {errors.pin && <p className="text-xs text-destructive">{errors.pin.message}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Set up a transaction passcode</div>
                    <div className="text-xs text-muted-foreground">Required for sensitive actions. Tap to add a 4–6 digit passcode.</div>
                  </div>
                </div>
                <ArrowLeftRight className="w-4 h-4 text-primary flex-shrink-0 rotate-90" />
              </button>
            )}

            <Button type="submit" className="w-full h-11 gap-2" disabled={loading || !recipient}>
              <ArrowLeftRight className="w-4 h-4" />
              {loading ? "Processing..." : recipient ? `Send to ${recipient.fullName}` : "Send Transfer"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
