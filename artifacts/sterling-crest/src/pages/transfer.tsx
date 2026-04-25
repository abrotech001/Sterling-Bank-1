import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { ArrowLeftRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/layout/dashboard-layout";

type TransferForm = {
  toAccountNumber: string;
  amount: string;
  description: string;
};

export default function TransferPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState<number | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TransferForm>();

  const onSubmit = async (data: TransferForm) => {
    setLoading(true);
    try {
      const res = await api.post<{ message: string; transactionId: number; status: string }>("/transactions/transfer", {
        toAccountNumber: data.toAccountNumber.trim(),
        amount: parseFloat(data.amount),
        description: data.description,
      });
      setTxId(res.transactionId);
      setSuccess(true);
      reset();
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
        <div className="max-w-md mx-auto pt-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-8 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Transfer Submitted</h2>
            <p className="text-muted-foreground mb-6">
              Your transfer has been submitted and is pending approval. You'll be notified once it's processed.
            </p>
            <p className="text-xs text-muted-foreground mb-6">Transaction ID: #{txId}</p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
              <Button variant="outline" className="flex-1" onClick={() => setSuccess(false)}>New Transfer</Button>
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
          <div className="flex items-center gap-3 mb-6 p-3 bg-primary/10 border border-primary/20 rounded-xl">
            <AlertCircle className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Transfers require KYC verification. Large transfers may require admin approval.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Recipient Account Number</Label>
              <Input
                placeholder="SCB-XXXXXXXXXX"
                {...register("toAccountNumber", { required: "Account number is required" })}
                className="h-11 font-mono"
              />
              {errors.toAccountNumber && <p className="text-xs text-destructive">{errors.toAccountNumber.message}</p>}
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
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What's this transfer for?"
                {...register("description")}
                className="resize-none h-20"
              />
            </div>

            <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
              <ArrowLeftRight className="w-4 h-4" />
              {loading ? "Processing..." : "Send Transfer"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
