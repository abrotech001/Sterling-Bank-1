import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Shield, Upload, CheckCircle2, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
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

export default function KYCPage() {
  const [, navigate] = useLocation();
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const kycLevel = user?.kycLevel ?? 0;
  const userStatus = user?.status;

  const handleFile = (
    file: File,
    setFile: (f: File) => void,
    setPreview: (p: string) => void
  ) => {
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!idNumber.trim()) {
      toast({ title: "Enter your ID number", variant: "destructive" });
      return;
    }
    if (!frontFile) {
      toast({ title: "Upload front of ID", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("documentType", idType);
      form.append("documentNumber", idNumber);
      form.append("frontImage", frontFile);
      if (backFile) form.append("backImage", backFile);
      if (selfieFile) form.append("selfie", selfieFile);

      await api.postForm("/kyc/submit", form);
      setSubmitted(true);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "KYC submission failed";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted || kycLevel >= 1) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto pt-12">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {kycLevel >= 1 ? "KYC Verified" : "Documents Submitted"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {kycLevel >= 1
                ? "Your identity has been verified. You now have full access to all Crestfield services."
                : "Your documents are under review. This typically takes 24-48 hours. You'll be notified once approved."}
            </p>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="text-sm">KYC Level: <span className="font-bold text-primary">{kycLevel} / 2</span></div>
            </div>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Identity Verification</h1>
          <p className="text-muted-foreground">Complete KYC to unlock full banking features</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { level: 0, label: "Basic", desc: "View balance only" },
            { level: 1, label: "Standard", desc: "Transfers & withdrawals" },
            { level: 2, label: "Premium", desc: "Unlimited access" },
          ].map((l) => (
            <div key={l.level} className={`p-3 rounded-xl border text-center ${kycLevel >= l.level ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <div className={`text-lg font-bold ${kycLevel >= l.level ? "text-primary" : "text-muted-foreground"}`}>L{l.level}</div>
              <div className="text-xs font-medium">{l.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
          <Lock className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Secure & Encrypted</p>
            <p className="text-muted-foreground mt-0.5">All documents are encrypted and handled in compliance with data protection regulations.</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold">Submit Identity Documents</h3>

          <div className="space-y-1.5">
            <Label>Document Type</Label>
            <Select value={idType} onValueChange={setIdType}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Document Number</Label>
            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. AB1234567" className="h-11" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Front of Document <span className="text-destructive">*</span></Label>
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-3 transition-colors text-center ${frontPreview ? "border-primary/30" : "border-border hover:border-primary/30"}`}>
                  {frontPreview ? (
                    <img src={frontPreview} alt="Front" className="h-20 mx-auto object-contain rounded" />
                  ) : (
                    <div className="py-3">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Upload front</p>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, setFrontFile, setFrontPreview); }} />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Back of Document</Label>
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-3 transition-colors text-center ${backPreview ? "border-primary/30" : "border-border hover:border-primary/30"}`}>
                  {backPreview ? (
                    <img src={backPreview} alt="Back" className="h-20 mx-auto object-contain rounded" />
                  ) : (
                    <div className="py-3">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Upload back</p>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, setBackFile, setBackPreview); }} />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Selfie with Document (optional but speeds up verification)</Label>
            <label className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-3 transition-colors text-center ${selfiePreview ? "border-primary/30" : "border-border hover:border-primary/30"}`}>
                {selfiePreview ? (
                  <img src={selfiePreview} alt="Selfie" className="h-28 mx-auto object-contain rounded" />
                ) : (
                  <div className="py-6">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Upload selfie holding your document</p>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, setSelfieFile, setSelfiePreview); }} />
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
