import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { User, Lock, Bell, Copy, CheckCircle2 } from "lucide-react";
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

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  const { register: regProfile, handleSubmit: handleProfile } = useForm<ProfileForm>({
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
    },
  });

  const { register: regPass, handleSubmit: handlePass, reset: resetPass } = useForm<PasswordForm>();

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

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{user?.firstName} {user?.lastName}</h3>
              <p className="text-muted-foreground text-sm">@{user?.username} • {user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-muted-foreground">{user?.accountNumber}</span>
                <button onClick={() => copy(user?.accountNumber ?? "")} className="text-muted-foreground hover:text-foreground">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1 gap-1.5"><User className="w-4 h-4" />Profile</TabsTrigger>
            <TabsTrigger value="security" className="flex-1 gap-1.5"><Lock className="w-4 h-4" />Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-6">
              <form onSubmit={handleProfile(updateProfile)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input {...regProfile("firstName")} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input {...regProfile("lastName")} className="h-11" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input {...regProfile("phone")} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input value={user?.email ?? ""} disabled className="h-11 opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed for security reasons</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input value={user?.country ?? ""} disabled className="h-11 opacity-60" />
                </div>
                <Button type="submit" className="w-full h-11" disabled={profileLoading}>
                  {profileLoading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-6">
              <form onSubmit={handlePass(updatePassword)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Current Password</Label>
                  <Input type="password" {...regPass("currentPassword", { required: true })} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" {...regPass("newPassword", { required: true, minLength: 8 })} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New Password</Label>
                  <Input type="password" {...regPass("confirmPassword", { required: true })} className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11" disabled={passLoading}>
                  {passLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
