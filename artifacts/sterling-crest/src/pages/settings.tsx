import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { User, Lock, Copy, KeyRound, Check, Camera, Trash2 } from "lucide-react";
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

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

async function resizeImageToDataUrl(file: File, maxSize = 512): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode-failed"));
      i.src = dataUrl;
    });
    const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    return canvas.toDataURL(mime, mime === "image/jpeg" ? 0.9 : undefined);
  } catch {
    return dataUrl;
  }
}

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Please upload a JPG or PNG image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }

    setAvatarLoading(true);
    try {
      const image = await resizeImageToDataUrl(file, 512);
      await api.post("/users/me/avatar", { image });
      await refresh();
      toast({ title: "Profile photo updated" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile photo";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAvatarLoading(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarLoading(true);
    try {
      await api.delete("/users/me/avatar");
      await refresh();
      toast({ title: "Profile photo removed" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAvatarLoading(false);
    }
  };

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
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border border-border flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/20 flex items-center justify-center text-lg sm:text-xl font-bold text-primary flex-shrink-0">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            )}
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

          <TabsContent value="profile" className="mt-3 space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                <div className="relative">
                  {user?.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/15 border-2 border-border flex items-center justify-center text-2xl font-bold text-primary">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onPickAvatar}
                    disabled={avatarLoading}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 disabled:opacity-50"
                    aria-label="Change profile photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">Profile Photo</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG or PNG, up to 5MB. Shown across your account.</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button type="button" variant="outline" size="sm" onClick={onPickAvatar} disabled={avatarLoading} className="h-8 text-xs gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      {avatarLoading ? "Uploading..." : user?.profileImage ? "Change photo" : "Upload photo"}
                    </Button>
                    {user?.profileImage && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} disabled={avatarLoading} className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={onAvatarChange}
                  />
                </div>
              </div>
            </div>

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
