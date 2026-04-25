import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { CheckCircle2, AlertCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/layout/dashboard-layout";

type WithdrawMethod = {
  id: string;
  name: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
};

type LocationData = { country: string; methods: WithdrawMethod[] };

type WithdrawForm = {
  amount: string;
  [key: string]: string;
};

export default function WithdrawPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<WithdrawMethod | null>(null);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState<number | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WithdrawForm>();

  useEffect(() => {
    api.get<LocationData>("/location/withdraw-methods")
      .then((data) => {
        setLocationData(data);
        if (data.methods.length > 0) setSelectedMethod(data.methods[0]);
      })
      .catch(() => {
        setLocationData({
          country: "International",
          methods: [
            { id: "cashapp", name: "Cash App", fields: [{ key: "cashappId", label: "Cash App $Cashtag", placeholder: "$username" }] },
            { id: "paypal", name: "PayPal", fields: [{ key: "paypalEmail", label: "PayPal Email", placeholder: "paypal@example.com" }] },
            { id: "revolut", name: "Revolut", fields: [{ key: "revolutTag", label: "Revolut @Tag", placeholder: "@username" }] },
            { id: "wire", name: "Wire Transfer", fields: [{ key: "bankName", label: "Bank Name", placeholder: "Chase Bank" }, { key: "accountNumber", label: "Account Number", placeholder: "••••0000" }, { key: "routingNumber", label: "Routing Number", placeholder: "021000021" }] },
          ],
        });
        setSelectedMethod({ id: "cashapp", name: "Cash App", fields: [{ key: "cashappId", label: "Cash App $Cashtag", placeholder: "$username" }] });
      })
      .finally(() => setLoadingLocation(false));
  }, []);

  const onSubmit = async (data: WithdrawForm) => {
    if (!selectedMethod) return;
    setLoading(true);
    try {
      const methodDetails: Record<string, string> = {};
      selectedMethod.fields.forEach((f) => { methodDetails[f.key] = data[f.key] || ""; });

      const res = await api.post<{ message: string; transactionId: number }>("/transactions/withdraw", {
        amount: parseFloat(data.amount),
        method: selectedMethod.id,
        methodDetails,
        description: `${selectedMethod.name} withdrawal`,
      });
      setTxId(res.transactionId);
      setSuccess(true);
      reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Withdrawal failed";
      toast({ title: "Withdrawal failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto pt-12">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Withdrawal Submitted</h2>
            <p className="text-muted-foreground mb-6">Your withdrawal request has been submitted and is pending approval. You'll be notified once it's processed.</p>
            <p className="text-xs text-muted-foreground mb-6">Transaction ID: #{txId}</p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
              <Button variant="outline" className="flex-1" onClick={() => setSuccess(false)}>New Withdrawal</Button>
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
          <h1 className="text-2xl font-bold">Withdraw Funds</h1>
          <p className="text-muted-foreground">Send money to your external account</p>
        </div>

        {loadingLocation ? (
          <Skeleton className="h-12 rounded-xl" />
        ) : locationData && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border px-4 py-2.5 rounded-xl">
            <MapPin className="w-4 h-4 text-primary" />
            Showing methods for: <span className="text-foreground font-medium">{locationData.country}</span>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-medium mb-3">Select Withdrawal Method</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {loadingLocation ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)
            ) : locationData?.methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMethod(m)}
                className={`p-3 rounded-xl border text-sm font-medium text-center transition-all ${
                  selectedMethod?.id === m.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {selectedMethod && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">Withdrawals require KYC verification and may take 1-3 business days to process.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    {...register("amount", { required: "Amount is required", min: { value: 1, message: "Minimum $1.00" } })}
                    className="h-11 pl-8"
                  />
                </div>
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>

              {selectedMethod.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label>{field.label}</Label>
                  <Input
                    type={field.type || "text"}
                    placeholder={field.placeholder}
                    {...register(field.key, { required: `${field.label} is required` })}
                    className="h-11"
                  />
                  {errors[field.key] && <p className="text-xs text-destructive">{errors[field.key]?.message}</p>}
                </div>
              ))}

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Processing..." : `Withdraw via ${selectedMethod.name}`}
              </Button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
