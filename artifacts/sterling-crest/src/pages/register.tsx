import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import type { User } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RegForm = {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone: string;
  country: string;
  password: string;
  confirmPassword: string;
};

type OtpForm = { otp: string };

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Switzerland", "Singapore",
  "Japan", "South Korea", "Brazil", "Mexico", "India", "South Africa",
  "Nigeria", "Kenya", "Ghana", "United Arab Emirates", "Saudi Arabia",
  "Qatar", "Kuwait", "Bahrain", "Oman", "New Zealand", "Sweden",
  "Norway", "Denmark", "Finland", "Poland", "Portugal", "Greece",
  "Turkey", "Israel", "China", "Hong Kong", "Malaysia", "Thailand",
  "Indonesia", "Philippines", "Pakistan", "Bangladesh", "Egypt", "Other",
];

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("");

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegForm>();
  const { register: regOtp, handleSubmit: handleOtp, formState: { errors: otpErrors } } = useForm<OtpForm>();

  const onRegister = async (data: RegForm) => {
    if (data.password !== data.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (!selectedCountry) {
      toast({ title: "Please select your country", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ userId: number; message: string }>("/auth/register", {
        ...data,
        country: selectedCountry,
      });
      setUserId(res.userId);
      setStep("otp");
      toast({ title: "OTP sent!", description: "Check your email for the verification code." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (data: OtpForm) => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>("/auth/verify-otp", {
        userId,
        otp: data.otp,
      });
      login(res.token, res.user);
      navigate("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">
            {step === "form" ? "Open your account" : "Verify your email"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {step === "form"
              ? "Join Crestfield Bank today"
              : "Enter the 6-digit code sent to your email"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSubmit(onRegister)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input placeholder="John" {...register("firstName", { required: "Required" })} className="h-11" />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input placeholder="Doe" {...register("lastName", { required: "Required" })} className="h-11" />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="you@example.com" {...register("email", { required: "Required" })} className="h-11" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input placeholder="johndoe123" {...register("username", { required: "Required", minLength: { value: 3, message: "At least 3 characters" } })} className="h-11" />
                  {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input placeholder="+1 234 567 8900" {...register("phone", { required: "Required" })} className="h-11" />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      {...register("password", { required: "Required", minLength: { value: 8, message: "Min 8 characters" } })}
                      className="h-11 pr-10"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    {...register("confirmPassword", { required: "Required" })}
                    className="h-11"
                  />
                </div>

                <Button type="submit" className="w-full h-11 text-base mt-2" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </motion.form>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-16 h-16 text-primary" />
                </div>
                <form onSubmit={handleOtp(onVerify)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Verification Code</Label>
                    <Input
                      placeholder="123456"
                      maxLength={6}
                      className="h-11 text-center text-2xl tracking-widest"
                      {...regOtp("otp", { required: "Required", minLength: { value: 6, message: "6 digits required" } })}
                    />
                    {otpErrors.otp && <p className="text-xs text-destructive">{otpErrors.otp.message}</p>}
                  </div>
                  <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                    {loading ? "Verifying..." : "Verify & Continue"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to registration
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {step === "form" && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-primary hover:underline font-medium">
                Sign in
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
