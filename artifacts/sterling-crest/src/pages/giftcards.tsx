import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { Gift, Upload, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { fileToBase64 } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GIFT_CARD_TYPES = [
  "Amazon", "iTunes / App Store", "Google Play", "Steam", "PlayStation",
  "Xbox", "Walmart", "Target", "Best Buy", "eBay", "Nike", "Sephora",
  "Starbucks", "Netflix", "Spotify", "Vanilla Visa", "Vanilla Mastercard",
  "American Express Gift Card", "Other",
];

type GiftCardForm = {
  declaredValue: string;
  cardNumber: string;
  pin: string;
};

type ImageState = { file: File | null; preview: string | null };

function ImageInput({
  label,
  state,
  setState,
}: {
  label: string;
  state: ImageState;
  setState: (s: ImageState) => void;
}) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setState({ file, preview: reader.result as string });
    reader.readAsDataURL(file);
  };

  const clear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ file: null, preview: null });
  };

  return (
    <div className="space-y-1.5">
      <Label>{label} <span className="text-destructive">*</span></Label>
      <label className="block cursor-pointer">
        <div className={`relative border-2 border-dashed rounded-xl transition-colors ${state.preview ? "border-primary/40" : "border-border hover:border-primary/40"} p-3`}>
          {state.preview ? (
            <>
              <img src={state.preview} alt={label} className="max-h-28 mx-auto rounded-lg object-contain" />
              <button onClick={clear} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
              <p className="text-[11px] text-muted-foreground text-center mt-1 truncate">{state.file?.name}</p>
            </>
          ) : (
            <div className="text-center py-4">
              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Tap to upload {label.toLowerCase()}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">PNG/JPG up to 10MB</p>
            </div>
          )}
        </div>
        <input type="file" accept="image/*" onChange={handle} className="hidden" />
      </label>
    </div>
  );
}

export default function GiftCardsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState<number | null>(null);
  const [front, setFront] = useState<ImageState>({ file: null, preview: null });
  const [back, setBack] = useState<ImageState>({ file: null, preview: null });
  const [selectedType, setSelectedType] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GiftCardForm>();

  const onSubmit = async (data: GiftCardForm) => {
    if (!selectedType) {
      toast({ title: "Please select a gift card type", variant: "destructive" });
      return;
    }
    if (!front.file || !back.file) {
      toast({
        title: "Both images are required",
        description: "Upload a clear photo of both the front and the back of your card.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const [frontImage, backImage] = await Promise.all([
        fileToBase64(front.file),
        fileToBase64(back.file),
      ]);
      const res = await api.post<{ message: string; transactionId: number }>("/giftcards/redeem", {
        cardType: selectedType,
        cardNumber: data.cardNumber,
        declaredValue: data.declaredValue,
        pin: data.pin || undefined,
        frontImage,
        backImage,
      });
      setTxId(res.transactionId);
      setSuccess(true);
      reset();
      setFront({ file: null, preview: null });
      setBack({ file: null, preview: null });
      setSelectedType("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto pt-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Gift Card Submitted</h2>
            <p className="text-muted-foreground text-sm mb-4">Your gift card has been submitted for review. Our team will verify and credit your account within 24 hours.</p>
            {txId && <p className="text-xs text-muted-foreground mb-4">Reference ID: #{txId}</p>}
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
              <Button variant="outline" className="flex-1" onClick={() => setSuccess(false)}>Submit Another</Button>
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
          <h1 className="text-xl sm:text-2xl font-bold">Redeem Gift Cards</h1>
          <p className="text-sm text-muted-foreground">Convert gift cards to cash in your account</p>
        </div>

        <div className="flex items-start gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-medium">Accepted denominations: $25, $50, $100, $200, $500</p>
            <p className="text-muted-foreground mt-0.5">We typically credit 85–95% of face value. All submissions are reviewed within 24 hours.</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gift Card Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select card type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {GIFT_CARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Declared Value (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="100.00"
                    {...register("declaredValue", { required: "Value is required", min: { value: 1, message: "Minimum $1" } })}
                    className="h-10 pl-8"
                  />
                </div>
                {errors.declaredValue && <p className="text-xs text-destructive">{errors.declaredValue.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Card Number / Code</Label>
              <Input
                placeholder="XXXX-XXXX-XXXX-XXXX"
                {...register("cardNumber", { required: "Card number is required" })}
                className="h-10 font-mono"
              />
              {errors.cardNumber && <p className="text-xs text-destructive">{errors.cardNumber.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>PIN (if applicable)</Label>
              <Input
                placeholder="Optional"
                {...register("pin")}
                className="h-10 font-mono"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Please upload <span className="font-semibold text-foreground">clear, well-lit photos</span> of both the front and the back of the card. Both images are required.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ImageInput label="Front of Card" state={front} setState={setFront} />
                <ImageInput label="Back of Card" state={back} setState={setBack} />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
              <Gift className="w-4 h-4" />
              {loading ? "Submitting..." : "Submit Gift Card"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
