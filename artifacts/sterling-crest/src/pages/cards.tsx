import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Plus, Trash2, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

type Card = {
  id: number;
  cardType: string;
  cardNetwork: string;
  cardName?: string | null;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
  status: string;
  isVirtual: boolean;
  createdAt: string;
};

const cardGradients: Record<string, string> = {
  visa: "from-blue-600 to-blue-900",
  mastercard: "from-red-600 to-orange-800",
  amex: "from-green-700 to-green-900",
  discover: "from-orange-500 to-orange-800",
};

export default function CardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [revealedCard, setRevealedCard] = useState<number | null>(null);
  const [cardNetwork, setCardNetwork] = useState("visa");
  const [cardType, setCardType] = useState("debit");
  const [cardholderName, setCardholderName] = useState("");
  const [cardName, setCardName] = useState("");

  const fetchCards = () => {
    api.get<Card[] | { cards: Card[] }>("/cards")
      .then((r) => setCards(Array.isArray(r) ? r : (r?.cards ?? [])))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCards(); }, []);

  const addCard = async () => {
    if (!cardName.trim()) {
      toast({ title: "Enter a card name", description: "e.g. Travel, Groceries, Main Card", variant: "destructive" });
      return;
    }
    if (!cardholderName.trim()) {
      toast({ title: "Enter cardholder name", variant: "destructive" });
      return;
    }
    setAddLoading(true);
    try {
      await api.post("/cards", { cardType, cardNetwork, cardholderName, cardName, isVirtual: true });
      fetchCards();
      setAddOpen(false);
      setCardholderName("");
      setCardName("");
      toast({ title: "Card issued successfully!" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to issue card";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAddLoading(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Cards</h1>
            <p className="text-muted-foreground">Manage your debit and virtual cards</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Issue Card</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue New Card</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Card Name</Label>
                  <Input
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="e.g. Travel, Groceries, Main Card"
                    className="h-11"
                    maxLength={40}
                  />
                  <p className="text-xs text-muted-foreground">A nickname so you can recognize this card.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Card Type</Label>
                  <Select value={cardType} onValueChange={setCardType}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit Card</SelectItem>
                      <SelectItem value="credit">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Network</Label>
                  <Select value={cardNetwork} onValueChange={setCardNetwork}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visa">Visa</SelectItem>
                      <SelectItem value="mastercard">Mastercard</SelectItem>
                      <SelectItem value="amex">American Express</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cardholder Name</Label>
                  <Input value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="JOHN DOE" className="h-11 uppercase" />
                </div>
                <Button className="w-full h-11" onClick={addCard} disabled={addLoading}>
                  {addLoading ? "Issuing..." : "Issue Card"}
                </Button>
              </div>
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
            <p className="text-muted-foreground">No cards yet. Issue your first card.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>Issue Card</Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <AnimatePresence>
              {cards.map((card, i) => {
                const gradient = cardGradients[card.cardNetwork] || "from-gray-700 to-gray-900";
                const revealed = revealedCard === card.id;
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.1 }}
                    className="relative"
                  >
                    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white relative overflow-hidden shadow-2xl aspect-video flex flex-col justify-between`}>
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-4 border-white/30" />
                        <div className="absolute top-8 right-8 w-32 h-32 rounded-full border-4 border-white/20" />
                      </div>

                      <div className="relative flex justify-between items-start">
                        <div>
                          <div className="text-xs text-white/60 uppercase tracking-widest mb-0.5">Crestfield</div>
                          <div className="text-sm font-bold leading-tight">{card.cardName || `${card.cardType} Card`}</div>
                          {card.cardName && (
                            <div className="text-[10px] text-white/60 uppercase tracking-wider">{card.cardType} CARD</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {card.isVirtual && (
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Virtual</span>
                          )}
                          <div className={`w-2 h-2 rounded-full ${card.status === "active" ? "bg-green-400" : "bg-red-400"}`} />
                        </div>
                      </div>

                      <div className="relative">
                        <div className="font-mono text-sm tracking-widest mb-3">
                          {revealed ? "5412 7534 8921 " : "•••• •••• •••• "}{card.last4}
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
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => setRevealedCard(revealed ? null : card.id)}
                      >
                        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {revealed ? "Hide" : "Reveal"}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => deleteCard(card.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
