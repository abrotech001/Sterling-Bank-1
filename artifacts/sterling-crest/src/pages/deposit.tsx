import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Copy, Info, Bitcoin, Wallet, ArrowLeftRight, Eye, EyeOff,
  ShieldAlert, Loader2, Sparkles, X, KeyRound, ArrowDownToLine,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import DashboardLayout from "@/components/layout/dashboard-layout";

type CryptoWallet = {
  id: number;
  btcAddress: string;
  ethAddress: string;
  usdtAddress: string;
  solAddress: string;
  xrpAddress: string;
  createdAt: string;
};

type CryptoSwap = {
  id: number;
  asset: string;
  assetName: string;
  amount: number;
  rate: number;
  cashValue: number;
  status: "pending" | "approved" | "rejected";
  declineReason?: string | null;
  createdAt: string;
};

const CRYPTO_ASSETS = [
  { id: "btc", name: "Bitcoin", symbol: "BTC", color: "from-orange-500 to-yellow-500", textColor: "text-orange-400", network: "Bitcoin (BTC)" },
  { id: "eth", name: "Ethereum", symbol: "ETH", color: "from-indigo-500 to-purple-500", textColor: "text-indigo-400", network: "ERC-20" },
  { id: "usdt", name: "Tether USD", symbol: "USDT", color: "from-emerald-500 to-teal-500", textColor: "text-emerald-400", network: "ERC-20" },
  { id: "sol", name: "Solana", symbol: "SOL", color: "from-fuchsia-500 to-purple-500", textColor: "text-fuchsia-400", network: "Solana (SOL)" },
  { id: "xrp", name: "XRP", symbol: "XRP", color: "from-sky-500 to-blue-500", textColor: "text-sky-400", network: "XRP Ledger" },
];

export default function DepositPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"crypto" | "bank">("crypto");

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Deposit Funds</h1>
          <p className="text-sm text-muted-foreground">Add money to your Crestfield account</p>
        </div>

        <div className="inline-flex bg-card border border-border rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab("crypto")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "crypto" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-crypto"
          >
            <Bitcoin className="w-4 h-4" /> Crypto
          </button>
          <button
            onClick={() => setTab("bank")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "bank" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-bank"
          >
            <Wallet className="w-4 h-4" /> Bank Transfer
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === "crypto" ? (
            <motion.div key="crypto" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <CryptoTab toast={toast} />
            </motion.div>
          ) : (
            <motion.div key="bank" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <BankTab user={user} toast={toast} navigate={navigate} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function CryptoTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<CryptoWallet | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [swaps, setSwaps] = useState<CryptoSwap[]>([]);

  // First-time creation flow
  const [creating, setCreating] = useState(false);
  const [newMnemonic, setNewMnemonic] = useState<string | null>(null);
  const [savedConfirm, setSavedConfirm] = useState(false);

  // Modals
  const [seedOpen, setSeedOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [receiveAsset, setReceiveAsset] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const w = await api.get<{ wallet: CryptoWallet | null; rates?: Record<string, number> }>("/crypto/wallet");
      setWallet(w.wallet);
      if (w.rates) setRates(w.rates);
      if (w.wallet) {
        const s = await api.get<{ swaps: CryptoSwap[] }>("/crypto/swaps");
        setSwaps(s.swaps);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load wallet";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.post<{ wallet: CryptoWallet; mnemonic: string; rates: Record<string, number> }>("/crypto/wallet", {});
      setWallet(res.wallet);
      setRates(res.rates);
      setNewMnemonic(res.mnemonic);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create wallet";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Compute balances per asset = sum of approved swaps subtracted from initial 0
  // Since this is deposit-receive (we don't actually monitor chain), balance is 0 unless user
  // enters a manual deposit. We'll show "0" by default but show pending swap totals.
  const portfolio = useMemo(() => {
    return CRYPTO_ASSETS.map((a) => {
      const pendingAmt = swaps.filter((s) => s.asset === a.id && s.status === "pending").reduce((sum, s) => sum + s.amount, 0);
      return {
        ...a,
        address: wallet ? (wallet[`${a.id}Address` as keyof CryptoWallet] as string) : "",
        balance: 0,
        pendingAmt,
        rate: rates[a.id] || 0,
      };
    });
  }, [wallet, rates, swaps]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  // First-time: no wallet yet
  if (!wallet) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Create your Crestfield Crypto Wallet</h2>
            <p className="text-sm text-muted-foreground mt-1">A self-custody wallet with 5 addresses (BTC, ETH, USDT, SOL, XRP). Generated on-device from a 12-word recovery phrase.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-5 gap-2">
          {CRYPTO_ASSETS.map((a) => (
            <div key={a.id} className={`p-3 rounded-xl bg-gradient-to-br ${a.color} text-white text-center`}>
              <div className="font-bold text-sm">{a.symbol}</div>
              <div className="text-[10px] opacity-90">{a.name}</div>
            </div>
          ))}
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            We'll show your <span className="text-foreground font-medium">12-word recovery phrase</span> only once. Save it offline — anyone with this phrase can access your funds.
          </p>
        </div>

        <Button onClick={create} disabled={creating} className="w-full h-11" data-testid="button-create-wallet">
          {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating wallet…</> : "Create Wallet"}
        </Button>
      </div>
    );
  }

  // Just created — show mnemonic once
  if (newMnemonic) {
    const words = newMnemonic.split(" ");
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Your Recovery Phrase
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Write these 12 words down in order. This is the only way to recover your wallet.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-background border border-border rounded-xl p-4">
          {words.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-sm" data-testid={`mnemonic-word-${i}`}>
              <span className="text-muted-foreground text-[11px] w-5">{i + 1}.</span>
              <span className="font-mono font-medium">{w}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { navigator.clipboard.writeText(newMnemonic); toast({ title: "Copied", description: "Recovery phrase copied — paste it into a secure note then delete from clipboard." }); }}
            data-testid="button-copy-mnemonic"
          >
            <Copy className="w-4 h-4 mr-1.5" /> Copy
          </Button>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">Crestfield support will <strong>never</strong> ask for your recovery phrase. Keep it offline.</p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <Checkbox checked={savedConfirm} onCheckedChange={(c) => setSavedConfirm(!!c)} data-testid="checkbox-saved-mnemonic" />
          <span className="text-sm">I have safely written down my recovery phrase.</span>
        </label>

        <Button
          className="w-full h-11"
          disabled={!savedConfirm}
          onClick={() => { setNewMnemonic(null); reload(); }}
          data-testid="button-mnemonic-continue"
        >
          Continue to Wallet
        </Button>
      </div>
    );
  }

  // Returning: portfolio dashboard
  const totalUsd = portfolio.reduce((sum, a) => sum + a.balance * a.rate, 0);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Total Crypto Holdings (est.)</div>
          <div className="text-3xl font-bold mt-1" data-testid="text-crypto-total">{formatCurrency(totalUsd)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setSwapOpen(true)} data-testid="button-quickswap">
            <ArrowLeftRight className="w-4 h-4 mr-1.5" /> QuickSwap
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSeedOpen(true)} data-testid="button-view-seed">
            <Eye className="w-4 h-4 mr-1.5" /> View Recovery Phrase
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {portfolio.map((a) => (
          <CryptoCard key={a.id} asset={a} onReceive={() => setReceiveAsset(a.id)} toast={toast} />
        ))}
      </div>

      {swaps.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
          <h3 className="font-semibold text-sm mb-3">Recent Swaps</h3>
          <div className="space-y-2">
            {swaps.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-sm" data-testid={`swap-${s.id}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{s.amount} {s.asset.toUpperCase()} → ${s.cashValue.toLocaleString()}</span>
                </div>
                <SwapStatus status={s.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {receiveAsset && (
          <ReceiveModal
            asset={CRYPTO_ASSETS.find((a) => a.id === receiveAsset)!}
            address={wallet[`${receiveAsset}Address` as keyof CryptoWallet] as string}
            onClose={() => setReceiveAsset(null)}
            toast={toast}
          />
        )}
        {swapOpen && (
          <SwapModal
            assets={portfolio}
            onClose={() => setSwapOpen(false)}
            onDone={() => { setSwapOpen(false); reload(); }}
            toast={toast}
          />
        )}
        {seedOpen && (
          <SeedModal onClose={() => setSeedOpen(false)} toast={toast} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SwapStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-yellow-500/15 text-yellow-500" },
    approved: { label: "Credited", cls: "bg-emerald-500/15 text-emerald-500" },
    rejected: { label: "Declined", cls: "bg-red-500/15 text-red-500" },
  };
  const s = map[status] || map.pending;
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

function CryptoCard({
  asset, onReceive, toast,
}: {
  asset: typeof CRYPTO_ASSETS[number] & { address: string; balance: number; rate: number; pendingAmt: number };
  onReceive: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const usd = asset.balance * asset.rate;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3" data-testid={`card-asset-${asset.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${asset.color} flex items-center justify-center text-white font-bold text-xs`}>
            {asset.symbol}
          </div>
          <div>
            <div className="font-semibold text-sm">{asset.name}</div>
            <div className="text-[11px] text-muted-foreground">${asset.rate.toLocaleString()} / {asset.symbol}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-xl font-bold">{asset.balance} <span className="text-xs text-muted-foreground font-normal">{asset.symbol}</span></div>
        <div className="text-xs text-muted-foreground">≈ {formatCurrency(usd)}</div>
        {asset.pendingAmt > 0 && (
          <div className="text-[10px] text-yellow-500 mt-0.5">{asset.pendingAmt} {asset.symbol} swap pending</div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-2 py-1.5">
        <span className="text-[11px] font-mono truncate" title={asset.address}>{asset.address.slice(0, 12)}…{asset.address.slice(-6)}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(asset.address); toast({ title: "Address copied" }); }}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          data-testid={`button-copy-${asset.id}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <Button size="sm" variant="outline" className="w-full h-9" onClick={onReceive} data-testid={`button-receive-${asset.id}`}>
        <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" /> Receive {asset.symbol}
      </Button>
    </div>
  );
}

function ReceiveModal({
  asset, address, onClose, toast,
}: {
  asset: typeof CRYPTO_ASSETS[number];
  address: string;
  onClose: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  return (
    <ModalShell onClose={onClose} title={`Receive ${asset.symbol}`}>
      <div className="text-sm text-muted-foreground -mt-2">Send only <span className="text-foreground font-medium">{asset.network}</span> assets to this address. Other networks may result in permanent loss.</div>
      <div className="bg-white p-4 rounded-2xl mx-auto w-fit">
        <QRCodeCanvas value={address} size={180} bgColor="#ffffff" fgColor="#000000" includeMargin={false} />
      </div>
      <div className="bg-background border border-border rounded-xl p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Your {asset.symbol} address</div>
        <div className="font-mono text-xs break-all" data-testid={`text-address-${asset.id}`}>{address}</div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(address); toast({ title: "Address copied" }); }}>
          <Copy className="w-4 h-4 mr-2" /> Copy Address
        </Button>
        <Button className="flex-1" onClick={onClose}>Done</Button>
      </div>
    </ModalShell>
  );
}

function SwapModal({
  assets, onClose, onDone, toast,
}: {
  assets: ({ id: string; symbol: string; rate: number; balance: number } & typeof CRYPTO_ASSETS[number])[];
  onClose: () => void;
  onDone: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [asset, setAsset] = useState(assets[0]?.id || "btc");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const sel = assets.find((a) => a.id === asset)!;
  const amt = parseFloat(amount) || 0;
  const cash = amt * sel.rate;

  const submit = async () => {
    if (amt <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }
    if (user?.hasPin && (!pin || pin.length < 4)) {
      toast({ title: "Enter your transaction passcode", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/crypto/swap", { asset, amount: amt, pin: pin || undefined });
      toast({
        title: "Swap submitted",
        description: "Your swap is pending review and may take some time to process.",
      });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="QuickSwap to Cash">
      <div className="text-xs text-muted-foreground -mt-2">Convert your crypto holdings to USD and credit them to your bank balance.</div>
      <div className="space-y-1.5">
        <Label>Asset</Label>
        <div className="grid grid-cols-5 gap-1">
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => setAsset(a.id)}
              className={`p-2 rounded-lg text-xs font-bold transition-all ${
                asset === a.id ? `bg-gradient-to-br ${a.color} text-white` : "bg-background border border-border text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`swap-asset-${a.id}`}
            >
              {a.symbol}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Amount in {sel.symbol}</Label>
        <Input
          type="number"
          step="0.00000001"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-11"
          data-testid="input-swap-amount"
        />
      </div>
      <div className="bg-background border border-border rounded-xl p-3 text-sm">
        <div className="flex justify-between text-muted-foreground"><span>Rate</span><span>${sel.rate.toLocaleString()} / {sel.symbol}</span></div>
        <div className="flex justify-between font-semibold mt-1"><span>You'll receive</span><span className="text-primary">{formatCurrency(cash)}</span></div>
      </div>
      {user?.hasPin && (
        <div className="space-y-1.5">
          <Label>Transaction passcode</Label>
          <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="h-11 tracking-widest text-center" data-testid="input-swap-pin" />
        </div>
      )}
      <Button className="w-full h-11" disabled={submitting || amt <= 0} onClick={submit} data-testid="button-confirm-swap">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Swap to ${formatCurrency(cash)}`}
      </Button>
    </ModalShell>
  );
}

function SeedModal({ onClose, toast }: { onClose: () => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const { user } = useAuth();
  const useMode = user?.hasPin ? "pin" : "password";
  const [secret, setSecret] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);

  const reveal = async () => {
    if (!secret) {
      toast({ title: useMode === "pin" ? "Enter your transaction passcode" : "Enter your password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ mnemonic: string }>("/crypto/seed", useMode === "pin" ? { pin: secret } : { password: secret });
      setRevealed(res.mnemonic);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to verify";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Recovery Phrase">
      {!revealed ? (
        <>
          <div className="text-sm text-muted-foreground -mt-2">
            Enter your {useMode === "pin" ? "transaction passcode" : "account password"} to reveal your 12-word recovery phrase.
          </div>
          <Input
            type="password"
            inputMode={useMode === "pin" ? "numeric" : "text"}
            maxLength={useMode === "pin" ? 6 : 64}
            placeholder={useMode === "pin" ? "••••" : "Password"}
            value={secret}
            onChange={(e) => setSecret(useMode === "pin" ? e.target.value.replace(/\D/g, "") : e.target.value)}
            className="h-11 tracking-widest text-center"
            data-testid="input-seed-credential"
          />
          <Button className="w-full h-11" disabled={loading} onClick={reveal} data-testid="button-reveal-seed">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reveal Phrase"}
          </Button>
        </>
      ) : (
        <>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2 text-xs">
            <ShieldAlert className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground">Make sure no one is watching your screen. Never share this phrase.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-background border border-border rounded-xl p-4 relative">
            {hidden && (
              <button onClick={() => setHidden(false)} className="absolute inset-0 backdrop-blur-md bg-card/30 flex items-center justify-center rounded-xl text-xs font-medium text-muted-foreground gap-2" data-testid="button-unhide-seed">
                <EyeOff className="w-4 h-4" /> Tap to reveal
              </button>
            )}
            {revealed.split(" ").map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-[11px] w-5">{i + 1}.</span>
                <span className="font-mono font-medium">{w}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(revealed); toast({ title: "Copied" }); }}>
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
            <Button className="flex-1" onClick={onClose}>Close</Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, scale: 0.97, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-background" data-testid="button-modal-close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Bank tab — kept identical to previous deposit page
// ============================================================================

const DEPOSIT_METHODS = [
  { id: "wire", label: "Wire Transfer", desc: "Domestic & international bank wire", time: "1-3 business days" },
  { id: "ach", label: "ACH Transfer", desc: "US bank account direct transfer", time: "2-5 business days" },
];

function BankTab({
  user, toast, navigate,
}: {
  user: ReturnType<typeof useAuth>["user"];
  toast: ReturnType<typeof useToast>["toast"];
  navigate: (p: string) => void;
}) {
  const [method, setMethod] = useState("wire");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard" });
  };

  const submit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/transactions/deposit", { amount: parseFloat(amount), method, description: `${method.toUpperCase()} deposit` });
      setSubmitted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Deposit request failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto pt-2">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Deposit Initiated</h2>
          <p className="text-sm text-muted-foreground mb-5">Your deposit of <span className="font-semibold text-foreground">{formatCurrency(amount)}</span> has been registered. Please complete the transfer using the instructions provided.</p>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
            <Button variant="outline" className="flex-1" onClick={() => { setSubmitted(false); setAmount(""); }}>New Deposit</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {DEPOSIT_METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={`p-3 rounded-xl border text-left transition-all ${
              method === m.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
            }`}
            data-testid={`bank-method-${m.id}`}
          >
            <div className="font-semibold text-sm">{m.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{m.desc}</div>
            <div className="text-[10px] text-primary mt-1 font-medium">{m.time}</div>
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Deposit Amount (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input type="number" step="0.01" min="1" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 pl-8" />
          </div>
          {amount && parseFloat(amount) > 0 && (
            <p className="text-xs text-muted-foreground">Amount: <span className="font-medium text-foreground">{formatCurrency(amount)}</span></p>
          )}
        </div>

        <div className="bg-background border border-border rounded-xl p-3 sm:p-4 space-y-2.5">
          <p className="text-sm font-medium flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            {method === "wire" ? "Wire Transfer Instructions" : "ACH Transfer Instructions"}
          </p>
          {[
            ["Bank Name", "Crestfield Bank"],
            ["Account Name", `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.username || "—"],
            ["Account Number", user?.accountNumber ?? ""],
            ["Routing Number", "026009593"],
            ...(method === "wire" ? [["SWIFT/BIC", "SCBKUS33"]] : []),
            ["Reference", `DEP-${user?.id}`],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono font-medium truncate">{val}</span>
                <button onClick={() => copy(val as string)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full h-11" onClick={submit} disabled={loading || !amount}>
          {loading ? "Processing..." : "Submit Deposit Request"}
        </Button>
      </div>
    </div>
  );
}
