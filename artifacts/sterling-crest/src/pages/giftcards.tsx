import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { Gift, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
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
  cardType: string;
  declaredValue: string;
  cardNumber: string;
  pin: string;
};

export default function GiftCardsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GiftCardForm>();

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: GiftCardForm) => {
    if (!selectedType) {
      toast({ title: "Please select a gift card type", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("cardType", selectedType);
      form.append("declaredValue", data.declaredValue);
      form.append("cardNumber", data.cardNumber);
      form.append("pin", data.pin);
      if (imageFile) form.append("image", imageFile);

      const res = await api.postForm<{ message: string; transactionId: number }>("/giftcards/redeem", form);
      setTxId(res.transactionId);
      setSuccess(true);
      reset();
      setImageFile(null);
      setImagePreview(null);
      setSelectedType("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Redemption failed";
      toast({ title: "Redemption failed", description: msg, variant: "destructive" });
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
            <h2 className="text-2xl font-bold mb-2">Gift Card Submitted</h2>
            <p className="text-muted-foreground mb-6">Your gift card has been submitted for review. Our team will verify and credit your account within 24 hours.</p>
            <p className="text-xs text-muted-foreground mb-6">Reference ID: #{txId}</p>
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
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Redeem Gift Cards</h1>
          <p className="text-muted-foreground">Convert gift cards to cash in your account</p>
        </div>

        <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Accepted denominations: $25, $50, $100, $200, $500</p>
            <p className="text-muted-foreground mt-0.5">We typically credit 85-95% of face value. All submissions are reviewed within 24 hours.</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Gift Card Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-11">
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
                  className="h-11 pl-8"
                />
              </div>
              {errors.declaredValue && <p className="text-xs text-destructive">{errors.declaredValue.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Card Number / Code</Label>
              <Input
                placeholder="XXXX-XXXX-XXXX-XXXX"
                {...register("cardNumber", { required: "Card number is required" })}
                className="h-11 font-mono"
              />
              {errors.cardNumber && <p className="text-xs text-destructive">{errors.cardNumber.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>PIN (if applicable)</Label>
              <Input
                placeholder="Optional PIN"
                {...register("pin")}
                className="h-11 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Upload Card Image (optional but recommended)</Label>
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl transition-colors ${imagePreview ? "border-primary/30" : "border-border hover:border-primary/30"} p-4`}>
                  {imagePreview ? (
                    <div className="text-center">
                      <img src={imagePreview} alt="Card" className="max-h-32 mx-auto rounded-lg mb-2 object-contain" />
                      <p className="text-xs text-muted-foreground">{imageFile?.name}</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload front of card</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, HEIC up to 10MB</p>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
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
