import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Shield,
  Upload,
  CheckCircle2,
  Lock,
  X,
  Clock,
  AlertCircle,
  FileText,
  Home,
  Receipt,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { fileToBase64 } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { onWSMessage } from "@/lib/websocket";
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

const ADDRESS_DOC_TYPES = [
  { value: "utility_bill", label: "Utility Bill (electricity / water / gas)", icon: Receipt },
  { value: "bank_statement", label: "Bank Statement", icon: Landmark },
  { value: "government_doc", label: "Government Document (tax / council)", icon: FileText },
];

type TierStatus = "not_started" | "pending" | "approved" | "rejected";
type TierInfo = { status: TierStatus; rejectionReason?: string; submittedAt?: string; reviewedAt?: string };
type KycStatus = { level: number; tier2: TierInfo; tier3: TierInfo };
type FileState = { file: File | null; preview: string | null };

const emptyFile: FileState = { file: null, preview: null };

export default function KYCPage() {
  const [, navigate] = useLocation();
  const { user, refresh } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // tier 2 inputs
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [front, setFront] = useState<FileState>(emptyFile);
  const [back, setBack] = useState<FileState>(emptyFile);
  const [selfie, setSelfie] = useState<FileState>(emptyFile);

  // tier 3 inputs
  const [docType, setDocType] = useState("utility_bill");
  const [address, setAddress] = useState("");
  const [docImage, setDocImage] = useState<FileState>(emptyFile);

  const loadStatus = async () => {
    try {
      const s = await api.get<KycStatus>("/kyc/status");
      setStatus(s);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStatus();
    const off = onWSMessage((msg) => {
      if (msg.type === "kyc_update") {
        loadStatus();
        refresh();
      }
    });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, set: (s: FileState) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set({ file, preview: reader.result as string });
    reader.readAsDataURL(file);
  };

  const submitTier2 = async () => {
    if (!fullName.trim()) { toast({ title: "Enter your full name", variant: "destructive" }); return; }
    if (!dob.trim()) { toast({ title: "Enter your date of birth", variant: "destructive" }); return; }
    if (!idNumber.trim()) { toast({ title: "Enter your ID number", variant: "destructive" }); return; }
    if (!front.file) { toast({ title: "Upload front of ID", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const [frontImage, backImage, selfieImage] = await Promise.all([
        fileToBase64(front.file),
        back.file ? fileToBase64(back.file) : Promise.resolve(undefined),
        selfie.file ? fileToBase64(selfie.file) : Promise.resolve(undefined),
      ]);
      await api.post("/kyc/submit", {
        tier: 2,
        fullName,
        dateOfBirth: dob,
        idType,
        idNumber,
        idFrontImage: frontImage,
        idBackImage: backImage,
        selfieImage,
      });
      toast({ title: "Tier 2 submitted", description: "Our team will review your documents shortly." });
      setFront(emptyFile); setBack(emptyFile); setSelfie(emptyFile);
      await loadStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitTier3 = async () => {
    if (!address.trim()) { toast({ title: "Enter your address as shown on the document", variant: "destructive" }); return; }
    if (!docImage.file) { toast({ title: "Upload your address document", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const docImg = await fileToBase64(docImage.file);
      await api.post("/kyc/submit", {
        tier: 3,
        idType: docType,
        idNumber: "ADDR-" + Date.now(),
        address,
        idFrontImage: docImg,
      });
      toast({ title: "Tier 3 submitted", description: "Our team will review your proof of address shortly." });
      setDocImage(emptyFile);
      setAddress("");
      await loadStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const level = user?.kycLevel ?? 0;
  const tierBadge = (n: number, label: string, desc: string, unlocked: boolean) => (
    <div
      key={n}
      className={`relative p-3 rounded-xl border text-center transition-all ${
        unlocked ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm" : "border-border bg-card"
      }`}
      data-testid={`tier-badge-${n}`}
    >
      {unlocked && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div className={`text-sm font-bold ${unlocked ? "text-primary" : "text-muted-foreground"}`}>{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</div>
    </div>
  );

  const StatusBanner = ({ tier, info, doneLabel }: { tier: 2 | 3; info: TierInfo; doneLabel: string }) => {
    if (info.status === "approved") {
      return (
        <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl" data-testid={`tier${tier}-approved`}>
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">{doneLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Approved by our compliance team.</p>
          </div>
        </div>
      );
    }
    if (info.status === "pending") {
      return (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl" data-testid={`tier${tier}-pending`}>
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="text-sm">
            <p className="font-semibold text-amber-600 dark:text-amber-400">Tier {tier} under review</p>
            <p className="text-xs text-muted-foreground mt-0.5">Our team typically reviews documents within 24-48 hours. You'll be notified automatically.</p>
          </div>
        </div>
      );
    }
    if (info.status === "rejected") {
      return (
        <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-xl" data-testid={`tier${tier}-rejected`}>
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Tier {tier} rejected</p>
            <p className="text-xs text-muted-foreground mt-0.5">{info.rejectionReason || "Please resubmit with clearer documents."}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Identity Verification</h1>
          <p className="text-sm text-muted-foreground">Complete each tier to unlock more features and higher limits.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {tierBadge(1, "Tier 1", "View balance & receive", true)}
          {tierBadge(2, "Tier 2", "Transfers & withdrawals", level >= 1)}
          {tierBadge(3, "Tier 3", "Unlimited limits", level >= 2)}
        </div>

        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <Lock className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <p className="font-medium">Secure & Encrypted</p>
            <p className="text-muted-foreground">All documents are encrypted and handled in compliance with data protection regulations.</p>
          </div>
        </div>

        {/* TIER 2 SECTION */}
        <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4" data-testid="section-tier2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Tier 2 — Identity Verification</h3>
                <p className="text-xs text-muted-foreground">Government-issued ID + selfie</p>
              </div>
            </div>
            {level >= 1 && (
              <span className="text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full font-semibold">Verified</span>
            )}
          </div>

          {status && <StatusBanner tier={2} info={status.tier2} doneLabel="Identity verified" />}

          {level < 1 && status?.tier2.status !== "pending" && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full Legal Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As shown on ID" className="h-10" data-testid="input-fullname" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-10" data-testid="input-dob" />
                </div>
                <div className="space-y-1.5">
                  <Label>Document Type</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger className="h-10" data-testid="select-idtype"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Document Number</Label>
                  <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. AB1234567" className="h-10" data-testid="input-idnumber" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "front", label: "Front of Document", state: front, set: setFront, required: true },
                  { key: "back", label: "Back of Document", state: back, set: setBack, required: false },
                ].map(({ key, label, state, set, required }) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
                    <label className="block cursor-pointer">
                      <div className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-colors ${state.preview ? "border-primary/40" : "border-border hover:border-primary/40"}`}>
                        {state.preview ? (
                          <>
                            <img src={state.preview} alt={label} className="h-20 mx-auto object-contain rounded" />
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); set(emptyFile); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive">
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
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, set)} data-testid={`upload-${key}`} />
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
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelfie(emptyFile); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive">
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
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setSelfie)} data-testid="upload-selfie" />
                </label>
              </div>

              <Button className="w-full h-11 gap-2" onClick={submitTier2} disabled={loading} data-testid="btn-submit-tier2">
                <Shield className="w-4 h-4" />
                {loading ? "Submitting..." : "Submit Tier 2"}
              </Button>
            </>
          )}
        </section>

        {/* TIER 3 SECTION */}
        <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4" data-testid="section-tier3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${level >= 1 ? "bg-primary/10" : "bg-muted"}`}>
                <Home className={`w-4 h-4 ${level >= 1 ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Tier 3 — Proof of Address</h3>
                <p className="text-xs text-muted-foreground">Utility bill / bank statement / government doc</p>
              </div>
            </div>
            {level >= 2 && (
              <span className="text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full font-semibold">Verified</span>
            )}
          </div>

          {level < 1 ? (
            <div className="flex items-start gap-3 p-3 bg-muted/50 border border-border rounded-xl">
              <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">Complete Tier 2 first to unlock Tier 3.</div>
            </div>
          ) : (
            <>
              {status && <StatusBanner tier={3} info={status.tier3} doneLabel="Address verified" />}

              {level < 2 && status?.tier3.status !== "pending" && (
                <>
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {ADDRESS_DOC_TYPES.map((d) => {
                        const Icon = d.icon;
                        const active = docType === d.value;
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setDocType(d.value)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${active ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-primary/40"}`}
                            data-testid={`doctype-${d.value}`}
                          >
                            <Icon className={`w-4 h-4 mb-1 ${active ? "text-primary" : "text-muted-foreground"}`} />
                            <div className="text-[11px] font-medium leading-tight">{d.label}</div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Document must be dated within the last 3 months and clearly show your name and address.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Address (as shown on document)</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State, ZIP" className="h-10" data-testid="input-address" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Upload Document <span className="text-destructive">*</span></Label>
                    <label className="block cursor-pointer">
                      <div className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-colors ${docImage.preview ? "border-primary/40" : "border-border hover:border-primary/40"}`}>
                        {docImage.preview ? (
                          <>
                            <img src={docImage.preview} alt="Address document" className="h-32 mx-auto object-contain rounded" />
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDocImage(emptyFile); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <div className="py-4">
                            <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                            <p className="text-xs text-muted-foreground">Click to upload (PDF or image)</p>
                          </div>
                        )}
                      </div>
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFile(e, setDocImage)} data-testid="upload-address-doc" />
                    </label>
                  </div>

                  <Button className="w-full h-11 gap-2" onClick={submitTier3} disabled={loading} data-testid="btn-submit-tier3">
                    <Home className="w-4 h-4" />
                    {loading ? "Submitting..." : "Submit Tier 3"}
                  </Button>
                </>
              )}
            </>
          )}
        </section>

        {level >= 2 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2">
            <Button onClick={() => navigate("/dashboard")} data-testid="btn-back-dashboard">Back to Dashboard</Button>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
