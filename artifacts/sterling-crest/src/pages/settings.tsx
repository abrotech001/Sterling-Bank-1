import { useState } from "react";
import { useForm } from "react-hook-form";
import { User, Lock, Copy, KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PinForm = {
  currentPin?: string;
  pin: string;
  confirmPin: string;
};

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  const { register: regProfile, handleSubmit: handleProfile } = useForm<ProfileForm>({
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
    },
  });

  const { register: regPass, handleSubmit: handlePass, reset: resetPass } = useForm<PasswordForm>();
  const { register: regPin, handleSubmit: handlePin, reset: resetPin, formState: { errors: pinErrors } } = useForm<PinForm>();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard" });
  };

  const updateProfile = async (data: ProfileForm) => {
    setProfileLoading(true);
    try {
      await api.patch("/users/me", data);
      await refresh();
      toast({ title: "Profile updated" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  };

  const updatePassword = async (data: PasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPassLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast({ title: "Password updated successfully" });
      resetPass();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setPassLoading(false);
    }
  };

  const updatePin = async (data: PinForm) => {
    if (!/^\d{4,6}$/.test(data.pin)) {
      toast({ title: "PIN must be 4-6 digits", variant: "destructive" });
      return;
    }
    if (data.pin !== data.confirmPin) {
      toast({ title: "PINs do not match", variant: "destructive" });
      return;
    }
    if (user?.hasPin && !data.currentPin) {
      toast({ title: "Enter your current passcode", variant: "destructive" });
      return;
    }
    setPinLoading(true);
    try {
      await api.post("/users/set-pin", {
        pin: data.pin,
        confirmPin: data.confirmPin,
        currentPin: user?.hasPin ? data.currentPin : undefined,
      });
      await refresh();
      resetPin();
      toast({ title: user?.hasPin ? "Transaction passcode updated" : "Transaction passcode set", description: "You'll be asked for it on every transaction." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update passcode";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account preferences</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/20 flex items-center justify-center text-lg sm:text-xl font-bold text-primary flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base truncate">{user?.firstName} {user?.lastName}</h3>
              <p className="text-muted-foreground text-xs truncate">@{user?.username} · {user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-mono text-muted-foreground">{user?.accountNumber}</span>
                <button onClick={() => copy(user?.accountNumber ?? "")} className="text-muted-foreground hover:text-foreground">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1 gap-1 text-xs sm:text-sm"><User className="w-3.5 h-3.5" />Profile</TabsTrigger>
            <TabsTrigger value="security" className="flex-1 gap-1 text-xs sm:text-sm"><Lock className="w-3.5 h-3.5" />Password</TabsTrigger>
            <TabsTrigger value="passcode" className="flex-1 gap-1 text-xs sm:text-sm"><KeyRound className="w-3.5 h-3.5" />Passcode</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <form onSubmit={handleProfile(updateProfile)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input {...regProfile("firstName")} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input {...regProfile("lastName")} className="h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input {...regProfile("phone")} className="h-10" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={user?.email ?? ""} disabled className="h-10 opacity-60" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <Input value={user?.country ?? ""} disabled className="h-10 opacity-60" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-10" disabled={profileLoading}>
                  {profileLoading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <form onSubmit={handlePass(updatePassword)} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Current Password</Label>
                  <Input type="password" {...regPass("currentPassword", { required: true })} className="h-10" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>New Password</Label>
                    <Input type="password" {...regPass("newPassword", { required: true, minLength: 8 })} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm New Password</Label>
                    <Input type="password" {...regPass("confirmPassword", { required: true })} className="h-10" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-10" disabled={passLoading}>
                  {passLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="passcode" className="mt-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3 p-3 mb-4 bg-primary/10 border border-primary/20 rounded-xl">
                <KeyRound className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-medium flex items-center gap-1.5">
                    Transaction Passcode
                    {user?.hasPin && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-primary/20 text-primary px-1.5 py-0.5 rounded"><Check className="w-2.5 h-2.5" /> Active</span>}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    A 4–6 digit passcode that authorizes every transfer, withdrawal and high-value action on your account.
                    {!user?.hasPin && " Set one now to start sending money."}
                  </p>
                </div>
              </div>

              <form onSubmit={handlePin(updatePin)} className="space-y-3">
                {user?.hasPin && (
                  <div className="space-y-1.5">
                    <Label>Current Passcode</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••"
                      {...regPin("currentPin", { required: user?.hasPin })}
                      className="h-10 font-mono tracking-widest"
                    />
                    {pinErrors.currentPin && <p className="text-xs text-destructive">Required</p>}
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{user?.hasPin ? "New Passcode" : "Passcode"}</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••"
                      {...regPin("pin", { required: true, pattern: { value: /^\d{4,6}$/, message: "4–6 digits" } })}
                      className="h-10 font-mono tracking-widest"
                    />
                    {pinErrors.pin && <p className="text-xs text-destructive">{pinErrors.pin.message || "4–6 digits required"}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm Passcode</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••"
                      {...regPin("confirmPin", { required: true })}
                      className="h-10 font-mono tracking-widest"
                    />
                    {pinErrors.confirmPin && <p className="text-xs text-destructive">Required</p>}
                  </div>
                </div>
                <Button type="submit" className="w-full h-10" disabled={pinLoading}>
                  {pinLoading
                    ? "Saving..."
                    : user?.hasPin
                    ? "Update Passcode"
                    : "Set Transaction Passcode"}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
