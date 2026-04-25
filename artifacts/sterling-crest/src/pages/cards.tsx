import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Plus, Trash2, Eye, EyeOff, Lock, ShieldCheck,
  Building2, Upload, X, AlertCircle, CheckCircle2, Clock, Ban, Sparkles, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { onWSMessage } from "@/lib/websocket";

type CardStatus = "inactive" | "pending_activation" | "active" | "deactivated" | "rejected";

type Card = {
  id: number;
  kind: "virtual" | "bank";
  cardType: string;
  cardNetwork: string;
  cardName?: string | null;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
  status: CardStatus;
  isVirtual: boolean;
  bankName?: string | null;
  country?: string | null;
  declineReason?: string | null;
  createdAt: string;
};

const ACTIVATION_FEE = 50;

const cardGradients: Record<string, string> = {
  visa: "from-blue-600 to-blue-900",
  mastercard: "from-red-600 to-orange-800",
  amex: "from-green-700 to-green-900",
  discover: "from-orange-500 to-orange-800",
  card: "from-slate-700 to-slate-900",
};

const COUNTRIES = ["United States", "United Kingdom", "Canada", "Germany", "France", "Australia", "Nigeria", "Ghana", "South Africa", "India", "Brazil", "Mexico", "Other"];

const statusMeta: Record<CardStatus, { label: string; dot: string; chip: string; icon: typeof Clock }> = {
  inactive: { label: "Inactive", dot: "bg-slate-400", chip: "bg-slate-500/15 text-slate-300 border-slate-500/30", icon: Lock },
  pending_activation: { label: "Pending", dot: "bg-yellow-400", chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", icon: Clock },
  active: { label: "Active", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  deactivated: { label: "Deactivated", dot: "bg-red-500", chip: "bg-red-500/15 text-red-300 border-red-500/30", icon: Ban },
  rejected: { label: "Rejected", dot: "bg-red-500", chip: "bg-red-500/15 text-red-300 border-red-500/30", icon: Ban },
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState<Card | null>(null);
  const [activating, setActivating] = useState(false);
  const [revealedCard, setRevealedCard] = useState<number | null>(null);

  const fetchCards = () => {
    api.get<{ cards: Card[] }>("/cards")
      .then((r) => setCards(r?.cards ?? []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCards(); }, []);

  // Live status updates
  useEffect(() => {
    const off = onWSMessage((msg: { type: string; data?: { cardId?: number; status?: CardStatus } }) => {
      if (msg.type === "card_status" && msg.data?.cardId) {
        fetchCards();
        const s = msg.data.status;
        if (s === "active") toast({ title: "Card activated!", description: "Your card is now active and ready to use." });
        if (s === "rejected") toast({ title: "Card review complete", description: "Unfortunately your card was not approved.", variant: "destructive" });
      }
    });
    return () => { if (typeof off === "function") off(); };
  }, [toast]);

  const activateCard = async () => {
    if (!activateOpen) return;
    setActivating(true);
    try {
      await api.post(`/cards/${activateOpen.id}/activate`, {});
      toast({ title: "Activation submitted", description: `$${ACTIVATION_FEE} deducted. Your card is being reviewed.` });
      setActivateOpen(null);
      fetchCards();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to activate card";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setActivating(false);
    }
  };

  const deleteCard = async (id: number) => {
    try {
      await api.delete(`/cards/${id}`);
      setCards((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Card removed" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove card";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Cards</h1>
            <p className="text-muted-foreground">Manage your virtual cards and linked bank cards</p>
          </div>
          <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-card"><Plus className="w-4 h-4" /> Add Card</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add a New Card</DialogTitle>
                <DialogDescription>Issue a Crestfield virtual card or link an existing bank card.</DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="virtual" className="mt-2">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="virtual" data-testid="tab-virtual"><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Virtual Card</TabsTrigger>
                  <TabsTrigger value="bank" data-testid="tab-bank"><Building2 className="w-3.5 h-3.5 mr-1.5" /> Bank Card</TabsTrigger>
                </TabsList>
                <TabsContent value="virtual" className="mt-4">
                  <VirtualCardForm onCreated={() => { setIssueOpen(false); fetchCards(); }} />
                </TabsContent>
                <TabsContent value="bank" className="mt-4">
                  <BankCardForm onCreated={() => { setIssueOpen(false); fetchCards(); }} />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : cards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-card border border-border rounded-2xl"
          >
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground">No cards yet. Issue a virtual card or link a bank card.</p>
            <Button className="mt-4" onClick={() => setIssueOpen(true)}>Add Card</Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <AnimatePresence>
              {cards.map((card, i) => (
                <CardItem
                  key={card.id}
                  card={card}
                  index={i}
                  revealed={revealedCard === card.id}
                  onToggleReveal={() => setRevealedCard(revealedCard === card.id ? null : card.id)}
                  onDelete={() => deleteCard(card.id)}
                  onActivate={() => setActivateOpen(card)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Activation confirmation dialog */}
      <Dialog open={!!activateOpen} onOpenChange={(o) => !o && setActivateOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-500" /> Activate Virtual Card</DialogTitle>
            <DialogDescription>
              Pay a one-time activation fee of <span className="font-semibold text-foreground">${ACTIVATION_FEE.toFixed(2)}</span> from your portfolio. Your card will be reviewed and activated within minutes. If declined, your fee is automatically refunded.
            </DialogDescription>
          </DialogHeader>
          {activateOpen && (
            <div className="bg-muted/30 border border-border rounded-xl p-4 my-2 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Card</span><span className="font-medium">{activateOpen.cardName || `${activateOpen.cardNetwork} Card`}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Number</span><span className="font-mono">•••• {activateOpen.last4}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Activation fee</span><span className="font-semibold">${ACTIVATION_FEE.toFixed(2)}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(null)} disabled={activating}>Cancel</Button>
            <Button onClick={activateCard} disabled={activating} data-testid="button-confirm-activate">
              {activating ? "Submitting..." : `Pay $${ACTIVATION_FEE.toFixed(2)} & Activate`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CardItem({
  card, index, revealed, onToggleReveal, onDelete, onActivate,
}: {
  card: Card;
  index: number;
  revealed: boolean;
  onToggleReveal: () => void;
  onDelete: () => void;
  onActivate: () => void;
}) {
  const meta = statusMeta[card.status] || statusMeta.inactive;
  const Icon = meta.icon;
  const isActive = card.status === "active";
  const gradient = isActive ? (cardGradients[card.cardNetwork] || cardGradients.card) : "from-slate-800 to-slate-950";
  const isPending = card.status === "pending_activation";
  const isInactive = card.status === "inactive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="relative"
      data-testid={`card-item-${card.id}`}
    >
      <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white relative overflow-hidden shadow-2xl aspect-video flex flex-col justify-between ${!isActive ? "opacity-90" : ""}`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-4 border-white/30" />
          <div className="absolute top-8 right-8 w-32 h-32 rounded-full border-4 border-white/20" />
        </div>

        <div className="relative flex justify-between items-start">
          <div>
            <div className="text-xs text-white/60 uppercase tracking-widest mb-0.5">
              {card.kind === "bank" ? card.bankName || "Bank Card" : "Crestfield"}
            </div>
            <div className="text-sm font-bold leading-tight">{card.cardName || `${card.cardType} Card`}</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider mt-0.5">
              {card.kind === "bank" ? "LINKED CARD" : "VIRTUAL CARD"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.chip} flex items-center gap-1 backdrop-blur-sm`} data-testid={`card-status-${card.id}`}>
              <Icon className="w-2.5 h-2.5" /> {meta.label}
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="font-mono text-sm tracking-widest mb-3">
            {revealed && isActive ? "5412 7534 8921 " : "•••• •••• •••• "}{card.last4}
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-white/60 uppercase tracking-widest">Cardholder</div>
              <div className="font-semibold text-sm uppercase">{card.cardholderName}</div>
            </div>
            <div>
              <div className="text-xs text-white/60 uppercase tracking-widest">Expires</div>
              <div className="font-semibold text-sm">{String(card.expiryMonth).padStart(2, "0")}/{String(card.expiryYear).slice(-2)}</div>
            </div>
            <div className="text-xl font-bold capitalize opacity-90">{card.cardNetwork}</div>
          </div>
        </div>

        {!isActive && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
            <div className="bg-black/60 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" /> {meta.label.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Decline reason */}
      {card.status === "rejected" && card.declineReason && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{card.declineReason}</span>
        </div>
      )}

      <div className="flex gap-2 mt-3 flex-wrap">
        {isInactive && card.kind === "virtual" && (
          <Button size="sm" className="flex-1 gap-1.5 bg-emerald-500 text-white hover:bg-emerald-600" onClick={onActivate} data-testid={`button-activate-${card.id}`}>
            <Zap className="w-3.5 h-3.5" /> Activate Card (${ACTIVATION_FEE})
          </Button>
        )}
        {isPending && (
          <Button size="sm" className="flex-1 gap-1.5" variant="outline" disabled>
            <Clock className="w-3.5 h-3.5" /> Awaiting Review
          </Button>
        )}
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={onToggleReveal}
            data-testid={`button-reveal-${card.id}`}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {revealed ? "Hide" : "Reveal"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={onDelete}
          data-testid={`button-delete-${card.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove
        </Button>
      </div>
    </motion.div>
  );
}

function VirtualCardForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [cardName, setCardName] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNetwork, setCardNetwork] = useState("visa");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!cardName.trim()) { toast({ title: "Enter a card name", variant: "destructive" }); return; }
    if (!cardholderName.trim()) { toast({ title: "Enter cardholder name", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await api.post("/cards", { cardNetwork, cardholderName, cardName });
      toast({ title: "Virtual card issued", description: `Activate it for $${ACTIVATION_FEE} to start using it.` });
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to issue card";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-muted-foreground flex gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <span>Your virtual card starts as <b>Inactive</b>. A one-time <b>${ACTIVATION_FEE}</b> activation fee is deducted from your portfolio to enable it. If declined, the fee is automatically refunded.</span>
      </div>
      <div className="space-y-1.5">
        <Label>Card Name</Label>
        <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="e.g. Travel, Groceries, Main Card" className="h-11" maxLength={40} data-testid="input-card-name" />
      </div>
      <div className="space-y-1.5">
        <Label>Network</Label>
        <Select value={cardNetwork} onValueChange={setCardNetwork}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="visa">Visa</SelectItem>
            <SelectItem value="mastercard">Mastercard</SelectItem>
            <SelectItem value="amex">American Express</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Cardholder Name</Label>
        <Input value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="JOHN DOE" className="h-11 uppercase" data-testid="input-cardholder" />
      </div>
      <Button className="w-full h-11" onClick={submit} disabled={submitting} data-testid="button-issue-virtual">
        {submitting ? "Issuing..." : "Issue Virtual Card"}
      </Button>
    </div>
  );
}

function BankCardForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [country, setCountry] = useState("");
  const [bankName, setBankName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const handleImage = async (file: File | undefined, setter: (v: string) => void) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Image too large", description: "Max 5 MB.", variant: "destructive" }); return; }
    const url = await fileToDataUrl(file);
    setter(url);
  };

  const formatNumber = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

  const submit = async () => {
    if (!cardholderName.trim()) { toast({ title: "Cardholder name required", variant: "destructive" }); return; }
    const clean = cardNumber.replace(/\s+/g, "");
    if (!/^\d{13,19}$/.test(clean)) { toast({ title: "Enter a valid card number", variant: "destructive" }); return; }
    if (!expiryMonth || !expiryYear) { toast({ title: "Enter expiry date", variant: "destructive" }); return; }
    if (!/^\d{3,4}$/.test(cvv)) { toast({ title: "Enter a valid CVV", variant: "destructive" }); return; }
    if (!country) { toast({ title: "Select country", variant: "destructive" }); return; }
    if (!bankName.trim()) { toast({ title: "Enter bank name", variant: "destructive" }); return; }
    if (!frontImage || !backImage) { toast({ title: "Upload front and back images", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      await api.post("/cards/bank", {
        cardholderName, cardNumber: clean, expiryMonth, expiryYear, cvv, country, bankName, billingAddress,
        frontImage, backImage,
      });
      toast({ title: "Card submitted for verification", description: "You'll be notified when the review is complete." });
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to submit card";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-muted-foreground flex gap-2">
        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <span>Your card will be securely submitted for verification. It cannot be used until approved.</span>
      </div>

      <div className="space-y-1.5">
        <Label>Cardholder Name</Label>
        <Input value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="JOHN DOE" className="h-11 uppercase" data-testid="input-bank-cardholder" />
      </div>

      <div className="space-y-1.5">
        <Label>Card Number</Label>
        <Input value={cardNumber} onChange={(e) => setCardNumber(formatNumber(e.target.value))} placeholder="0000 0000 0000 0000" className="h-11 font-mono tracking-widest" data-testid="input-bank-number" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label>MM</Label>
          <Input value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="12" className="h-11 text-center" data-testid="input-expiry-month" />
        </div>
        <div className="space-y-1.5">
          <Label>YY</Label>
          <Input value={expiryYear} onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="28" className="h-11 text-center" data-testid="input-expiry-year" />
        </div>
        <div className="space-y-1.5">
          <Label>CVV</Label>
          <Input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" className="h-11 text-center" type="password" data-testid="input-cvv" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="h-11" data-testid="select-country"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Bank Name</Label>
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Chase, Wells Fargo..." className="h-11" data-testid="input-bank-name" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">Billing Address <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
        <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="123 Main St, City, ZIP" className="h-11" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ImageDropZone label="Front of Card" image={frontImage} onPick={() => frontRef.current?.click()} onClear={() => setFrontImage(null)} testId="upload-front" />
        <ImageDropZone label="Back of Card" image={backImage} onPick={() => backRef.current?.click()} onClear={() => setBackImage(null)} testId="upload-back" />
        <input ref={frontRef} type="file" accept="image/*" hidden onChange={(e) => handleImage(e.target.files?.[0], setFrontImage)} />
        <input ref={backRef} type="file" accept="image/*" hidden onChange={(e) => handleImage(e.target.files?.[0], setBackImage)} />
      </div>

      <Button className="w-full h-11" onClick={submit} disabled={submitting} data-testid="button-submit-bank">
        {submitting ? "Submitting..." : "Submit for Verification"}
      </Button>
    </div>
  );
}

function ImageDropZone({ label, image, onPick, onClear, testId }: { label: string; image: string | null; onPick: () => void; onClear: () => void; testId?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {image ? (
        <div className="relative h-24 rounded-lg overflow-hidden border border-border">
          <img src={image} alt={label} className="w-full h-full object-cover" />
          <button type="button" onClick={onClear} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onPick} className="h-24 w-full rounded-lg border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors" data-testid={testId}>
          <Upload className="w-4 h-4" />
          <span>Upload</span>
        </button>
      )}
    </div>
  );
}
