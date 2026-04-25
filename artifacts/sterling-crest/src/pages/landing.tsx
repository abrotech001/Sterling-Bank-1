import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Globe, TrendingUp, Lock, CreditCard, ArrowRight, CheckCircle2, X, FileText, ShieldCheck } from "lucide-react";
import { CrestfieldLogo } from "@/components/brand/logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const features = [
  { icon: Shield, title: "Bank-Grade Security", desc: "256-bit encryption and multi-factor authentication on every transaction." },
  { icon: Zap, title: "Instant Transfers", desc: "Send money globally in seconds with zero hidden fees." },
  { icon: Globe, title: "Multi-Currency", desc: "Hold, send, and receive in over 40 currencies worldwide." },
  { icon: TrendingUp, title: "Smart Investments", desc: "Grow your wealth with our AI-powered portfolio management." },
  { icon: Lock, title: "FDIC Insured", desc: "Your deposits are insured up to $250,000 for complete peace of mind." },
  { icon: CreditCard, title: "Premium Cards", desc: "Titanium debit and credit cards with worldwide acceptance." },
];

const stats = [
  { value: "2.4M+", label: "Active Customers" },
  { value: "$18B+", label: "Assets Under Management" },
  { value: "98.9%", label: "Uptime SLA" },
  { value: "140+", label: "Countries Served" },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const } }),
};

type LegalKey = "privacy" | "terms" | "security";

const LEGAL_CONTENT: Record<LegalKey, { title: string; icon: typeof Shield; sections: { heading: string; body: string }[] }> = {
  privacy: {
    title: "Privacy Policy",
    icon: Lock,
    sections: [
      {
        heading: "Information we collect",
        body: "When you open and use a Crestfield Bank account, we collect the information needed to provide our services securely. This includes your account details (name, contact information, identity verification), transaction history (transfers, deposits, withdrawals, card activity), and basic device and session information (device type, IP address, browser, location signals) used to keep your account safe.",
      },
      {
        heading: "How we use your data",
        body: "We use your information to process transactions, verify your identity, prevent fraud, and improve the experience of every Crestfield product you rely on. We may also use aggregated, non-identifying data to enhance reliability and develop new features that benefit our customers.",
      },
      {
        heading: "How we protect your data",
        body: "All sensitive information is encrypted in transit and at rest using industry-grade encryption. Access is strictly limited to authorised personnel and is monitored continuously. Our infrastructure is hosted in secure facilities and audited against modern banking and data-protection standards.",
      },
      {
        heading: "We never sell your data",
        body: "Crestfield Bank does not sell, rent, or trade your personal data to third parties for marketing purposes. We only share information with trusted service providers and regulators when strictly required to operate your account or comply with the law.",
      },
      {
        heading: "Your control",
        body: "You can review and update your profile, request a copy of your data, or close your account at any time from your settings. Contact our support team if you need help managing your privacy preferences.",
      },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    icon: FileText,
    sections: [
      {
        heading: "Acceptance of terms",
        body: "By creating or using a Crestfield Bank account, you agree to use our platform responsibly, lawfully, and for legitimate financial activity. These terms govern your use of all Crestfield products and services.",
      },
      {
        heading: "Eligibility",
        body: "You must be at least 18 years old, complete identity verification, and provide accurate, up-to-date information. Accounts that fail verification or are flagged as fraudulent may be restricted or closed.",
      },
      {
        heading: "Account security",
        body: "You are responsible for keeping your password, transaction passcode, and one-time codes confidential at all times. Crestfield staff will never ask for these. Any activity performed using your credentials is considered authorised by you.",
      },
      {
        heading: "Suspicious activity",
        body: "Crestfield Bank reserves the right to pause, restrict, or close any account that shows signs of fraud, abuse, money laundering, or violations of applicable law. We may also request additional verification when needed.",
      },
      {
        heading: "Transaction rules",
        body: "Transfers, deposits, withdrawals, and card payments are subject to processing times, daily limits, and verification requirements. Certain regions, currencies, or recipients may be restricted in line with regulatory requirements.",
      },
      {
        heading: "Updates to these terms",
        body: "We may update these terms from time to time to reflect product changes, security improvements, or new regulations. Continued use of your account after changes are published means you accept the updated terms.",
      },
    ],
  },
  security: {
    title: "Security Information",
    icon: ShieldCheck,
    sections: [
      {
        heading: "End-to-end transaction protection",
        body: "Every transaction on Crestfield Bank is encrypted from your device to our servers. Card numbers, account details, and personal data are protected with strong cryptography to keep your money and information safe.",
      },
      {
        heading: "Multi-factor authentication",
        body: "Sensitive actions are protected by additional layers of security, including email verification, one-time passcodes (OTP), and your private transaction passcode. This ensures that only you can authorise activity on your account.",
      },
      {
        heading: "24/7 fraud detection",
        body: "Our automated risk engine continuously monitors transactions for unusual behaviour, suspicious logins, and high-risk patterns. When something looks wrong, we may temporarily pause activity and ask you to confirm it was you.",
      },
      {
        heading: "Secure infrastructure",
        body: "Crestfield Bank runs on secure, monitored infrastructure with strict access controls, intrusion detection, and routine security testing. Backups and recovery systems keep your data safe even in unexpected events.",
      },
      {
        heading: "How you can stay safe",
        body: "Never share your password, OTP, or transaction passcode with anyone — not even Crestfield staff. Always check that you're on the official Crestfield Bank website, ignore suspicious links, and contact support immediately if you notice anything unusual on your account.",
      },
    ],
  },
};

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [openLegal, setOpenLegal] = useState<LegalKey | null>(null);
  const legal = openLegal ? LEGAL_CONTENT[openLegal] : null;
  const LegalIcon = legal?.icon;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CrestfieldLogo size={32} />
            <span className="text-lg font-bold tracking-tight">Crestfield Bank</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security</a>
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Sign In</Button>
            <Button size="sm" onClick={() => navigate("/register")}>Open Account</Button>
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 text-center py-24">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8"
          >
            <CheckCircle2 className="w-4 h-4" />
            Regulated & Insured Banking Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight"
          >
            Banking Built for
            <span className="block text-primary">The Modern World</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Crestfield Bank offers premium digital banking with instant global transfers, 
            smart investments, and enterprise-grade security — all in one elegant platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="text-base px-8 h-12 gap-2" onClick={() => navigate("/register")}>
              Open Free Account <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 h-12" onClick={() => navigate("/login")}>
              Sign Into Banking
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="py-16 border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Everything you need to bank better</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From everyday spending to long-term wealth management, we have it covered.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="py-24 bg-card/30">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-4xl font-bold mb-4">Your security is our priority</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              We employ military-grade encryption and adhere to the strictest financial regulatory standards to keep your money safe 24/7.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {["256-bit SSL", "2FA Required", "Real-time Monitoring", "Fraud Protection"].map((t) => (
                <span key={t} className="px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-4">Ready to transform your banking?</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join millions of customers who trust Crestfield Bank for their financial future.
            </p>
            <Button size="lg" className="text-base px-10 h-12 gap-2" onClick={() => navigate("/register")}>
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CrestfieldLogo size={24} />
            <span className="font-semibold text-sm">Crestfield Bank</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            © 2025 Crestfield Bank. Member FDIC. Equal Housing Lender.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <button onClick={() => setOpenLegal("privacy")} className="hover:text-foreground transition-colors">Privacy</button>
            <button onClick={() => setOpenLegal("terms")} className="hover:text-foreground transition-colors">Terms</button>
            <button onClick={() => setOpenLegal("security")} className="hover:text-foreground transition-colors">Security</button>
          </div>
        </div>
      </footer>

      <Dialog open={openLegal !== null} onOpenChange={(open) => !open && setOpenLegal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {LegalIcon && <LegalIcon className="w-5 h-5 text-primary" />}
              {legal?.title}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {legal?.sections.map((s, i) => (
              <div key={i}>
                <h4 className="font-semibold text-sm mb-1.5">{s.heading}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Have questions? Reach out to <span className="text-foreground font-medium">support@crestfieldbank.com</span> at any time.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
