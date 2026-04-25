import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Shield, Upload, CheckCircle2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { fileToBase64 } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "residence_permit", label: "Residence Permit" },
];

const TIERS = [
  { level: 0, label: "Tier 1", desc: "View balance only" },
  { level: 1, label: "Tier 2", desc: "Transfers & withdrawals" },
  { level: 2, label: "Tier 3", desc: "Unlimited access" },
];

type FileState = { file: File | null; preview: string | null };

export default function KYCPage() {
  const [, navigate] = useLocation();
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [front, setFront] = useState<FileState>({ file: null, preview: null });
  const [back, setBack] = useState<FileState>({ file: null, preview: null });
  const [selfie, setSelfie] = useState<FileState>({ file: null, preview: null });

  const tier = (user?.kycLevel ?? 0) + 1;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, set: (s: FileState) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set({ file, preview: reader.result as string });
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!idNumber.trim()) {
      toast({ title: "Enter your ID number", variant: "destructive" });
      return;
    }
    if (!front.file) {
      toast({ title: "Upload front of ID", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const [frontImage, backImage, selfieImage] = await Promise.all([
        fileToBase64(front.file),
        back.file ? fileToBase64(back.file) : Promise.resolve(undefined),
        selfie.file ? fileToBase64(selfie.file) : Promise.resolve(undefined),
      ]);

      await api.post("/kyc/submit", {
        documentType: idType,
        documentNumber: idNumber,
        idType,
        idNumber,
        frontImage,
        backImage,
        selfie: selfieImage,
        idFrontImage: frontImage,
        idBackImage: backImage,
        selfieImage,
      });
      setSubmitted(true);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted || (user?.kycLevel ?? 0) >= 1) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto pt-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {(user?.kycLevel ?? 0) >= 1 ? "Identity Verified" : "Documents Submitted"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {(user?.kycLevel ?? 0) >= 1
                ? "Your identity has been verified. You now have full access to all Crestfield services."
                : "Your documents are under review. This typically takes 24-48 hours. You'll be notified once approved."}
            </p>
            <div className="text-sm mb-5">
              Current Tier: <span className="font-bold text-primary">Tier {tier}</span> / Tier 3
            </div>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Identity Verification</h1>
          <p className="text-sm text-muted-foreground">Complete verification to upgrade your account tier</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <div key={t.level} className={`p-2.5 rounded-xl border text-center ${(user?.kycLevel ?? 0) >= t.level ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <div className={`text-sm font-bold ${(user?.kycLevel ?? 0) >= t.level ? "text-primary" : "text-muted-foreground"}`}>{t.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.desc}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <Lock className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <p className="font-medium">Secure & Encrypted</p>
            <p className="text-muted-foreground">All documents are encrypted and handled in compliance with data protection regulations.</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="font-semibold text-sm">Submit Identity Documents</h3>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Document Number</Label>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. AB1234567" className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Front", state: front, set: setFront, required: true },
              { label: "Back", state: back, set: setBack, required: false },
            ].map(({ label, state, set, required }) => (
              <div key={label} className="space-y-1.5">
                <Label>{label} of Document {required && <span className="text-destructive">*</span>}</Label>
                <label className="block cursor-pointer">
                  <div className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-colors ${state.preview ? "border-primary/40" : "border-border hover:border-primary/40"}`}>
                    {state.preview ? (
                      <>
                        <img src={state.preview} alt={label} className="h-20 mx-auto object-contain rounded" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); set({ file: null, preview: null }); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="py-3">
                        <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-[11px] text-muted-foreground">Upload {label.toLowerCase()}</p>
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, set)} />
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Selfie with Document <span className="text-muted-foreground text-xs">(speeds up verification)</span></Label>
            <label className="block cursor-pointer">
              <div className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-colors ${selfie.preview ? "border-primary/40" : "border-border hover:border-primary/40"}`}>
                {selfie.preview ? (
                  <>
                    <img src={selfie.preview} alt="Selfie" className="h-24 mx-auto object-contain rounded" />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelfie({ file: null, preview: null }); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="py-4">
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Upload selfie holding your document</p>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setSelfie)} />
            </label>
          </div>

          <Button className="w-full h-11 gap-2" onClick={submit} disabled={loading}>
            <Shield className="w-4 h-4" />
            {loading ? "Submitting..." : "Submit for Verification"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
