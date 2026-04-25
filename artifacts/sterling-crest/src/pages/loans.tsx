import { motion } from "framer-motion";
import { Landmark, Clock, ShieldCheck, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const products = [
  {
    name: "Personal Line of Credit",
    rate: "From 6.99% APR",
    blurb: "Flexible borrowing up to $250,000 for life's important moments.",
    badge: "Most popular",
  },
  {
    name: "Home Equity Loan",
    rate: "From 5.49% APR",
    blurb: "Unlock equity in your home with a low fixed rate over 5–30 years.",
    badge: "Fixed rate",
  },
  {
    name: "Wealth-Backed Loan",
    rate: "From 4.25% APR",
    blurb: "Borrow against your portfolio without liquidating positions.",
    badge: "Premier",
  },
];

export default function LoansPage() {
  const [, navigate] = useLocation();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-3 flex-wrap"
        >
          <div>
            <h1 className="text-2xl font-bold">Loans</h1>
            <p className="text-muted-foreground">Premier lending, tailored to you.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/support")}>
            Talk to a banker
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 lg:p-8"
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Pre-qualified offers
            </div>
            <h2 className="text-xl lg:text-2xl font-semibold mb-1">Borrow with confidence.</h2>
            <p className="text-muted-foreground max-w-xl">
              Crestfield clients receive concierge-grade lending decisions, often within 24 hours. Complete KYC verification to unlock your personalized rate.
            </p>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => navigate("/kyc")}>Start application</Button>
              <Button variant="ghost" onClick={() => navigate("/support")}>Ask a question</Button>
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {products.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {p.badge}
                </span>
              </div>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-primary font-medium mt-0.5">{p.rate}</p>
              <p className="text-sm text-muted-foreground mt-2">{p.blurb}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => navigate("/support")}
              >
                Request details
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Clock, label: "24-hour decisions" },
            { icon: ShieldCheck, label: "Bank-level encryption" },
            { icon: Sparkles, label: "Member rate discounts" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50">
              <f.icon className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
