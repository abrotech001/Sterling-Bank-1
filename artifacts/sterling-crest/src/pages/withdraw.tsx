import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertCircle, MapPin, ArrowLeft, ChevronRight, Loader2, Search, Building2,
} from "lucide-react";
import { CashAppIcon, PayPalIcon, VenmoIcon, ZelleIcon, BankIcon, BitcoinIcon } from "@/components/brand/payment-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";

type Step = "method" | "details" | "review" | "done";

type MethodId = "cashapp" | "paypal" | "venmo" | "zelle" | "bank" | "crypto";

interface MethodConfig {
  id: MethodId;
  name: string;
  description: string;
  feePct: number;
  feeMin: number;
  eta: string;
  Brand: React.ComponentType<{ size?: number; className?: string }>;
}

const METHODS: MethodConfig[] = [
  { id: "cashapp", name: "Cash App", description: "Send to a $Cashtag", feePct: 0, feeMin: 0, eta: "Instant", Brand: CashAppIcon },
  { id: "paypal", name: "PayPal", description: "Send to a PayPal email", feePct: 0.5, feeMin: 1, eta: "Within 1 hour", Brand: PayPalIcon },
  { id: "venmo", name: "Venmo", description: "Send to a Venmo username", feePct: 0, feeMin: 0, eta: "Instant", Brand: VenmoIcon },
  { id: "zelle", name: "Zelle", description: "US bank-to-bank, instant", feePct: 0, feeMin: 0, eta: "Within minutes", Brand: ZelleIcon },
  { id: "bank", name: "Bank Transfer", description: "Domestic ACH or Wire / SWIFT", feePct: 0.25, feeMin: 5, eta: "1-3 business days", Brand: BankIcon },
  { id: "crypto", name: "Crypto Withdrawal", description: "Send to BTC, ETH, USDT, SOL, XRP", feePct: 1, feeMin: 2, eta: "Within 30 minutes", Brand: BitcoinIcon },
];

const POPULAR_US_BANKS = [
  { name: "Chase Bank", routing: "021000021", swift: "CHASUS33", logo: "https://logo.clearbit.com/chase.com" },
  { name: "Bank of America", routing: "026009593", swift: "BOFAUS3N", logo: "https://logo.clearbit.com/bankofamerica.com" },
  { name: "Wells Fargo", routing: "121000248", swift: "WFBIUS6S", logo: "https://logo.clearbit.com/wellsfargo.com" },
  { name: "Citibank", routing: "021000089", swift: "CITIUS33", logo: "https://logo.clearbit.com/citi.com" },
  { name: "U.S. Bank", routing: "091000022", swift: "USBKUS44IMT", logo: "https://logo.clearbit.com/usbank.com" },
  { name: "PNC Bank", routing: "043000096", swift: "PNCCUS33", logo: "https://logo.clearbit.com/pnc.com" },
  { name: "Truist Bank", routing: "061000104", swift: "BRBTUS33", logo: "https://logo.clearbit.com/truist.com" },
  { name: "Capital One", routing: "031176110", swift: "HIBKUS44", logo: "https://logo.clearbit.com/capitalone.com" },
  { name: "TD Bank", routing: "031201360", swift: "NRTHUS33", logo: "https://logo.clearbit.com/td.com" },
  { name: "Goldman Sachs (Marcus)", routing: "124085244", swift: "GSCRUS33", logo: "https://logo.clearbit.com/marcus.com" },
  { name: "Ally Bank", routing: "124003116", swift: "", logo: "https://logo.clearbit.com/ally.com" },
  { name: "American Express Bank", routing: "124085066", swift: "AEIBUS33", logo: "https://logo.clearbit.com/americanexpress.com" },
  { name: "Charles Schwab Bank", routing: "121202211", swift: "CSCHUS6S", logo: "https://logo.clearbit.com/schwab.com" },
  { name: "Discover Bank", routing: "031100649", swift: "DISCUS31", logo: "https://logo.clearbit.com/discover.com" },
  { name: "Fifth Third Bank", routing: "042000314", swift: "FTBCUS3C", logo: "https://logo.clearbit.com/53.com" },
  { name: "Other Bank", routing: "", swift: "", logo: "" },
];

const CRYPTO_NETWORKS = [
  { id: "btc", name: "Bitcoin", symbol: "BTC", network: "Bitcoin", color: "from-orange-500 to-yellow-500" },
  { id: "eth", name: "Ethereum", symbol: "ETH", network: "ERC-20", color: "from-indigo-500 to-purple-500" },
  { id: "usdt", name: "Tether USD", symbol: "USDT", network: "ERC-20", color: "from-emerald-500 to-teal-500" },
  { id: "sol", name: "Solana", symbol: "SOL", network: "Solana", color: "from-fuchsia-500 to-purple-500" },
  { id: "xrp", name: "XRP", symbol: "XRP", network: "XRP Ledger", color: "from-sky-500 to-blue-500" },
];

const ACCOUNT_TYPES = ["Checking", "Savings"];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Switzerland", "Singapore", "Hong Kong",
  "Japan", "South Korea", "United Arab Emirates", "South Africa", "Nigeria",
  "Brazil", "Mexico", "India", "Other",
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "HKD", "AED"];

const TRANSFER_TYPES = [
  { id: "ach", label: "Domestic ACH", desc: "US-only, 2-3 business days, lowest fees" },
  { id: "domestic_wire", label: "Domestic Wire", desc: "US wire, same/next day" },
  { id: "intl_wire", label: "International Wire (SWIFT)", desc: "1-3 business days, higher fees" },
];

interface Details {
  // Cash App
  cashappId?: string;
  // PayPal
  paypalEmail?: string;
  // Venmo
  venmoUsername?: string;
  // Zelle
  zelleIdentifier?: string;
  recipientName?: string;
  // Bank
  transferType?: string;
  bankName?: string;
  bankCustom?: string;
  accountHolder?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  accountType?: string;
  bankAddress?: string;
  beneficiaryAddress?: string;
  country?: string;
  currency?: string;
  intermediaryBank?: string;
  intermediarySwift?: string;
  purposeOfPayment?: string;
  acceptedCompliance?: boolean;
  // Crypto
  cryptoAsset?: string;
  cryptoAddress?: string;
}

export default function WithdrawPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<MethodConfig | null>(null);
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState<Details>({});
  const [submitting, setSubmitting] = useState(false);
  const [country, setCountry] = useState("United States");
  const [txId, setTxId] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ country: string }>("/location/withdraw-methods")
      .then((d) => setCountry(d.country))
      .catch(() => {});
  }, []);

  const fee = useMemo(() => {
    if (!method || !amount) return 0;
    const amt = parseFloat(amount) || 0;
    return Math.max(method.feeMin, +(amt * (method.feePct / 100)).toFixed(2));
  }, [method, amount]);

  const total = useMemo(() => (parseFloat(amount) || 0) + fee, [amount, fee]);

  const reset = () => {
    setStep("method");
    setMethod(null);
    setAmount("");
    setDetails({});
    setTxId(null);
  };

  const goReview = () => {
    if (!method || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!validateDetails(method.id, details)) {
      toast({ title: "Please complete all required fields", variant: "destructive" });
      return;
    }
    setStep("review");
  };

  const submit = async () => {
    if (!method) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; transactionId: number }>("/transactions/withdraw", {
        amount: parseFloat(amount),
        method: method.id,
        methodDetails: details as Record<string, unknown>,
        description: `${method.name} withdrawal`,
      });
      setTxId(res.transactionId);
      setStep("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Withdrawal failed";
      toast({ title: "Withdrawal failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          {step !== "method" && step !== "done" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStep(step === "review" ? "details" : "method")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-[clamp(1.125rem,5vw,1.5rem)] font-bold leading-tight">Withdraw Funds</h1>
            <p className="text-sm text-muted-foreground">
              {step === "method" && "Choose a withdrawal method"}
              {step === "details" && method && `${method.name} details`}
              {step === "review" && "Review & confirm"}
              {step === "done" && "Confirmation"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border px-3 py-2 rounded-xl">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          Region: <span className="text-foreground font-medium">{country}</span>
        </div>

        <AnimatePresence mode="wait">
          {step === "method" && (
            <motion.div key="method" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <MethodGrid onPick={(m) => { setMethod(m); setStep("details"); }} />
            </motion.div>
          )}

          {step === "details" && method && (
            <motion.div key="details" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <DetailsForm
                method={method}
                amount={amount}
                setAmount={setAmount}
                details={details}
                setDetails={setDetails}
                fee={fee}
                total={total}
              />
              <Button className="w-full h-11" onClick={goReview} data-testid="button-continue-review">
                Continue to Review <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {step === "review" && method && (
            <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <ReviewCard method={method} amount={amount} fee={fee} total={total} details={details} />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button variant="outline" onClick={() => setStep("details")} disabled={submitting}>Edit</Button>
                <Button onClick={submit} disabled={submitting} data-testid="button-confirm-withdrawal">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Submit"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Withdrawal Submitted</h2>
              <p className="text-sm text-muted-foreground mb-2">
                We've received your request and our compliance team is reviewing it. You'll be notified the moment it's processed.
              </p>
              <p className="text-xs text-muted-foreground mb-6">Reference: #{txId}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => navigate("/transactions")} data-testid="button-view-transactions">View Transactions</Button>
                <Button onClick={() => { reset(); navigate("/dashboard"); }}>Back to Dashboard</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function validateDetails(method: MethodId, d: Details): boolean {
  switch (method) {
    case "cashapp": return !!d.cashappId;
    case "paypal": return !!d.paypalEmail;
    case "venmo": return !!d.venmoUsername;
    case "zelle": return !!d.zelleIdentifier && !!d.recipientName;
    case "bank": {
      if (!d.transferType || !d.accountHolder || !d.accountNumber || !d.bankName) return false;
      if (d.transferType !== "intl_wire" && !d.routingNumber) return false;
      if (d.transferType === "intl_wire" && (!d.swiftCode || !d.country || !d.currency)) return false;
      return !!d.acceptedCompliance;
    }
    case "crypto": return !!d.cryptoAsset && !!d.cryptoAddress;
  }
}

function MethodGrid({ onPick }: { onPick: (m: MethodConfig) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {METHODS.map((m) => (
        <button
          key={m.id}
          onClick={() => onPick(m)}
          className="group bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/50 hover:bg-card/80 hover:-translate-y-0.5 transition-all duration-200"
          data-testid={`method-${m.id}`}
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
              <m.Brand size={48} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{m.name}</div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{m.description}</div>
              <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                <span className="text-primary font-medium">{m.eta}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {m.feePct === 0 && m.feeMin === 0 ? "No fee" : `Fee: ${m.feePct}% (min $${m.feeMin})`}
                </span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function DetailsForm({
  method, amount, setAmount, details, setDetails, fee, total,
}: {
  method: MethodConfig;
  amount: string;
  setAmount: (s: string) => void;
  details: Details;
  setDetails: (d: Details) => void;
  fee: number;
  total: number;
}) {
  const set = <K extends keyof Details>(key: K, value: Details[K]) => setDetails({ ...details, [key]: value });

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shadow-md">
          <method.Brand size={40} />
        </div>
        <div>
          <div className="font-semibold text-sm">{method.name}</div>
          <div className="text-[11px] text-muted-foreground">{method.eta} · {method.feePct === 0 && method.feeMin === 0 ? "No fee" : `${method.feePct}% (min $${method.feeMin})`}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Amount (USD)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            type="number"
            step="0.01"
            min="1"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 pl-8"
            data-testid="input-amount"
          />
        </div>
        {parseFloat(amount) > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>Fee: {formatCurrency(fee)}</span>
            <span>Total debit: <span className="text-foreground font-medium">{formatCurrency(total)}</span></span>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4 space-y-4">
        {method.id === "cashapp" && (
          <Field label="Cash App $Cashtag" placeholder="$username" value={details.cashappId} onChange={(v) => set("cashappId", v)} testId="input-cashapp" />
        )}

        {method.id === "paypal" && (
          <Field label="PayPal Email" type="email" placeholder="recipient@example.com" value={details.paypalEmail} onChange={(v) => set("paypalEmail", v)} testId="input-paypal" />
        )}

        {method.id === "venmo" && (
          <Field label="Venmo Username" placeholder="@username" value={details.venmoUsername} onChange={(v) => set("venmoUsername", v)} testId="input-venmo" />
        )}

        {method.id === "zelle" && (
          <>
            <Field label="Email or US Phone Number" placeholder="user@email.com or +1 555 555 5555" value={details.zelleIdentifier} onChange={(v) => set("zelleIdentifier", v)} testId="input-zelle-id" />
            <Field label="Recipient's Name" placeholder="As registered with Zelle" value={details.recipientName} onChange={(v) => set("recipientName", v)} testId="input-zelle-name" />
          </>
        )}

        {method.id === "bank" && (
          <BankFields details={details} set={set} />
        )}

        {method.id === "crypto" && (
          <CryptoFields details={details} set={set} />
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", testId,
}: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; type?: string; testId?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} placeholder={placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-11" data-testid={testId} />
    </div>
  );
}

function BankFields({
  details, set,
}: {
  details: Details;
  set: <K extends keyof Details>(k: K, v: Details[K]) => void;
}) {
  const [bankSearch, setBankSearch] = useState("");
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const isIntl = details.transferType === "intl_wire";
  const filteredBanks = useMemo(
    () => POPULAR_US_BANKS.filter((b) => b.name.toLowerCase().includes(bankSearch.toLowerCase())),
    [bankSearch],
  );
  const selectedBank = POPULAR_US_BANKS.find((b) => b.name === details.bankName);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Transfer Type</Label>
        <div className="grid sm:grid-cols-3 gap-2">
          {TRANSFER_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => set("transferType", t.id)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                details.transferType === t.id ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/30"
              }`}
              data-testid={`transfer-type-${t.id}`}
            >
              <div className="font-medium text-xs">{t.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {details.transferType && (
        <>
          <div className="space-y-1.5">
            <Label>Bank</Label>
            <button
              type="button"
              onClick={() => setBankPickerOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 h-11 px-3 rounded-md border border-input bg-background hover:bg-card text-left"
              data-testid="button-bank-picker"
            >
              <div className="flex items-center gap-2 min-w-0">
                {selectedBank?.logo && <img src={selectedBank.logo} alt="" className="w-5 h-5 rounded object-contain bg-white/5" />}
                <span className="text-sm truncate">{details.bankName || "Choose a bank"}</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${bankPickerOpen ? "rotate-90" : ""}`} />
            </button>

            {bankPickerOpen && (
              <div className="bg-background border border-border rounded-xl p-2 space-y-1 max-h-72 overflow-y-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="Search popular US banks…"
                    className="h-9 pl-8"
                    data-testid="input-bank-search"
                  />
                </div>
                {filteredBanks.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => {
                      set("bankName", b.name);
                      if (b.routing) set("routingNumber", b.routing);
                      if (b.swift) set("swiftCode", b.swift);
                      setBankPickerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-card text-left ${
                      details.bankName === b.name ? "bg-primary/10" : ""
                    }`}
                    data-testid={`bank-option-${b.name.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {b.logo ? (
                      <img src={b.logo} alt="" className="w-7 h-7 rounded object-contain bg-white/5 flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-muted flex items-center justify-center text-xs flex-shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{b.name}</div>
                      {b.routing && (
                        <div className="text-[10px] text-muted-foreground">Routing: {b.routing}{b.swift && ` · SWIFT: ${b.swift}`}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {details.bankName === "Other Bank" && (
            <Field label="Bank Name (custom)" value={details.bankCustom} onChange={(v) => { set("bankCustom", v); set("bankName", v); }} testId="input-bank-custom" />
          )}

          <Field label="Account Holder Name" value={details.accountHolder} onChange={(v) => set("accountHolder", v)} placeholder="Full legal name" testId="input-holder" />
          <Field label="Account Number / IBAN" value={details.accountNumber} onChange={(v) => set("accountNumber", v)} placeholder="Account or IBAN" testId="input-account" />

          {!isIntl ? (
            <Field label="Routing Number (ABA)" value={details.routingNumber} onChange={(v) => set("routingNumber", v)} placeholder="9 digits" testId="input-routing" />
          ) : (
            <Field label="SWIFT / BIC" value={details.swiftCode} onChange={(v) => set("swiftCode", v)} placeholder="e.g. CHASUS33" testId="input-swift" />
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <select
                value={details.accountType || ""}
                onChange={(e) => set("accountType", e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
                data-testid="select-account-type"
              >
                <option value="">Select…</option>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <select
                value={details.currency || "USD"}
                onChange={(e) => set("currency", e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
                data-testid="select-currency"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {isIntl && (
            <>
              <div className="space-y-1.5">
                <Label>Beneficiary Country</Label>
                <select
                  value={details.country || ""}
                  onChange={(e) => set("country", e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="select-country"
                >
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Field label="Beneficiary Bank Address" value={details.bankAddress} onChange={(v) => set("bankAddress", v)} placeholder="Street, City, Country" testId="input-bank-address" />
              <Field label="Beneficiary Address" value={details.beneficiaryAddress} onChange={(v) => set("beneficiaryAddress", v)} placeholder="Street, City, Country" testId="input-benef-address" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Intermediary Bank (optional)" value={details.intermediaryBank} onChange={(v) => set("intermediaryBank", v)} placeholder="Bank name" testId="input-intermediary" />
                <Field label="Intermediary SWIFT (optional)" value={details.intermediarySwift} onChange={(v) => set("intermediarySwift", v)} placeholder="SWIFT/BIC" testId="input-intermediary-swift" />
              </div>
            </>
          )}

          <Field label="Purpose of Payment" value={details.purposeOfPayment} onChange={(v) => set("purposeOfPayment", v)} placeholder="e.g. Salary, Personal funds" testId="input-purpose" />

          <label className="flex items-start gap-3 cursor-pointer select-none p-3 bg-background border border-border rounded-xl">
            <input
              type="checkbox"
              checked={!!details.acceptedCompliance}
              onChange={(e) => set("acceptedCompliance", e.target.checked)}
              className="mt-0.5"
              data-testid="checkbox-compliance"
            />
            <span className="text-xs text-muted-foreground">
              I confirm the recipient details are correct and that this transaction complies with applicable AML & sanctions regulations. I understand that wire transfers cannot be reversed once submitted.
            </span>
          </label>
        </>
      )}
    </div>
  );
}

function CryptoFields({
  details, set,
}: {
  details: Details;
  set: <K extends keyof Details>(k: K, v: Details[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Asset & Network</Label>
        <div className="grid grid-cols-5 gap-2">
          {CRYPTO_NETWORKS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set("cryptoAsset", c.id)}
              className={`p-2 rounded-lg text-xs font-bold transition-all ${
                details.cryptoAsset === c.id ? `bg-gradient-to-br ${c.color} text-white` : "bg-background border border-border text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`crypto-asset-${c.id}`}
            >
              {c.symbol}
            </button>
          ))}
        </div>
        {details.cryptoAsset && (
          <div className="text-[11px] text-muted-foreground">
            Network: <span className="text-foreground font-medium">{CRYPTO_NETWORKS.find((c) => c.id === details.cryptoAsset)?.network}</span>
          </div>
        )}
      </div>
      <Field label="Recipient Address" value={details.cryptoAddress} onChange={(v) => set("cryptoAddress", v)} placeholder="Paste destination wallet address" testId="input-crypto-address" />
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2 text-xs">
        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-muted-foreground">Verify the address and network. Crypto withdrawals to incorrect addresses cannot be reversed.</p>
      </div>
    </div>
  );
}

function ReviewCard({
  method, amount, fee, total, details,
}: {
  method: MethodConfig;
  amount: string;
  fee: number;
  total: number;
  details: Details;
}) {
  const rows = buildReviewRows(method.id, details);
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
          <method.Brand size={48} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Withdrawing via</div>
          <div className="font-bold">{method.name}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Amount</div>
          <div className="font-bold text-lg" data-testid="review-amount">{formatCurrency(amount)}</div>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(([label, val]) => (
          <div key={label} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted-foreground flex-shrink-0">{label}</span>
            <span className="text-right font-medium break-all max-w-[60%]">{val}</span>
          </div>
        ))}
      </div>

      <div className="bg-background border border-border rounded-xl p-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Withdrawal amount</span><span>{formatCurrency(amount)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Network/Service fee</span><span>{formatCurrency(fee)}</span></div>
        <div className="flex justify-between font-bold pt-1.5 border-t border-border"><span>Total debit</span><span className="text-primary">{formatCurrency(total)}</span></div>
        <div className="flex justify-between text-xs text-muted-foreground pt-1"><span>Estimated arrival</span><span>{method.eta}</span></div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2 text-xs">
        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-muted-foreground">Withdrawals require KYC verification and pass an automated security review. You'll receive a notification once your transfer is processed.</p>
      </div>
    </div>
  );
}

function buildReviewRows(method: MethodId, d: Details): [string, string][] {
  const rows: [string, string][] = [];
  if (method === "cashapp") rows.push(["Cash App", d.cashappId || "—"]);
  if (method === "paypal") rows.push(["PayPal Email", d.paypalEmail || "—"]);
  if (method === "venmo") rows.push(["Venmo Username", d.venmoUsername || "—"]);
  if (method === "zelle") {
    rows.push(["Recipient", d.recipientName || "—"]);
    rows.push(["Zelle ID", d.zelleIdentifier || "—"]);
  }
  if (method === "bank") {
    const tt = TRANSFER_TYPES.find((t) => t.id === d.transferType);
    rows.push(["Type", tt?.label || "—"]);
    rows.push(["Bank", d.bankName || "—"]);
    rows.push(["Account Holder", d.accountHolder || "—"]);
    rows.push(["Account #", d.accountNumber ? d.accountNumber.replace(/.(?=.{4})/g, "•") : "—"]);
    if (d.routingNumber) rows.push(["Routing", d.routingNumber]);
    if (d.swiftCode) rows.push(["SWIFT/BIC", d.swiftCode]);
    if (d.country) rows.push(["Country", d.country]);
    if (d.currency) rows.push(["Currency", d.currency]);
    if (d.intermediaryBank) rows.push(["Intermediary", `${d.intermediaryBank}${d.intermediarySwift ? ` (${d.intermediarySwift})` : ""}`]);
    if (d.purposeOfPayment) rows.push(["Purpose", d.purposeOfPayment]);
  }
  if (method === "crypto") {
    const c = CRYPTO_NETWORKS.find((c) => c.id === d.cryptoAsset);
    rows.push(["Asset", c ? `${c.name} (${c.symbol})` : "—"]);
    rows.push(["Network", c?.network || "—"]);
    rows.push(["Address", d.cryptoAddress ? `${d.cryptoAddress.slice(0, 12)}…${d.cryptoAddress.slice(-6)}` : "—"]);
  }
  return rows;
}
