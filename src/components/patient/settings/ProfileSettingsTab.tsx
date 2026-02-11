import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useSecurityEvents } from "@/hooks/useSecurityEvents";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  MapPin,
  Lock,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  X,
  Mail,
  Building2,
  BadgeCheck,
  CalendarIcon,
  AlertTriangle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProfileData {
  first_name: string;
  last_name: string;
  phone: string;
  organization: string;
  license_number: string;
  license_expiration_date: string | null;
  avatar_url: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export function ProfileSettingsTab() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { logSecurityEvent } = useSecurityEvents();
  
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: "",
    last_name: "",
    phone: "",
    organization: "",
    license_number: "",
    license_expiration_date: null,
    avatar_url: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile data on mount - need to fetch full profile with address fields
  useEffect(() => {
    const loadFullProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error loading profile:", error);
        return;
      }
      
      if (data) {
        setProfileData({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
          organization: data.organization || "",
          license_number: data.license_number || "",
          license_expiration_date: data.license_expiration_date || null,
          avatar_url: data.avatar_url || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          city: data.city || "",
          state: data.state || "",
          postal_code: data.postal_code || "",
          country: data.country || "",
        });
      }
    };
    
    loadFullProfile();
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          organization: data.organization,
          license_number: data.license_number,
          license_expiration_date: data.license_expiration_date,
          avatar_url: data.avatar_url,
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          country: data.country,
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshProfile(); // Refresh auth context profile
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      });
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      toast({
        title: "Failed to update profile",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfileMutation.mutateAsync(profileData);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Delete old avatar if exists
      if (profileData.avatar_url && profileData.avatar_url.includes('avatars')) {
        const oldPath = profileData.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfileData({ ...profileData, avatar_url: publicUrl });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshProfile(); // Refresh auth context profile
      
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      });
    } catch (error: unknown) {
      console.error("Failed to upload avatar:", error);
      toast({
        title: "Upload failed",
        description: (error as Error).message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    
    setUploadingAvatar(true);
    try {
      // Delete from storage if it's a stored avatar
      if (profileData.avatar_url && profileData.avatar_url.includes('avatars')) {
        const oldPath = profileData.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfileData({ ...profileData, avatar_url: '' });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshProfile(); // Refresh auth context profile
      
      toast({
        title: "Avatar removed",
        description: "Your profile picture has been removed.",
      });
    } catch (error: unknown) {
      console.error("Failed to remove avatar:", error);
      toast({
        title: "Failed to remove avatar",
        description: (error as Error).message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      
      if (error) throw error;
      
      // Log password change security event - this will trigger an email notification
      await logSecurityEvent({
        eventType: "password_change",
        category: "authentication",
        severity: "warning",
        description: "Password was changed successfully",
        metadata: {
          action: "password_change",
          initiated_by: "user",
        },
      });
      
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Failed to change password:", error);
      toast({
        title: "Failed to change password",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter a new email address.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (newEmail === user?.email) {
      toast({
        title: "Same email",
        description: "The new email is the same as your current email.",
        variant: "destructive",
      });
      return;
    }

    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Verification email sent",
        description: "Please check both your current and new email inboxes to confirm the change.",
      });
    } catch (error: unknown) {
      console.error("Failed to change email:", error);
      toast({
        title: "Failed to change email",
        description: (error as Error).message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const getInitials = () => {
    const first = profileData.first_name?.[0] || "";
    const last = profileData.last_name?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Update your name and contact details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profileData.avatar_url} alt="Profile" />
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-base font-medium">Profile Picture</Label>
                <p className="text-sm text-muted-foreground">
                  Upload a photo (JPEG, PNG, GIF, or WebP, max 5MB)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
                {profileData.avatar_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Name Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                placeholder="John"
                value={profileData.first_name}
                onChange={(e) =>
                  setProfileData({ ...profileData, first_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                placeholder="Doe"
                value={profileData.last_name}
                onChange={(e) =>
                  setProfileData({ ...profileData, last_name: e.target.value })
                }
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed here
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={profileData.phone}
              onChange={(e) =>
                setProfileData({ ...profileData, phone: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Use international format for SMS/WhatsApp (e.g., +234...)
            </p>
          </div>

          {/* Organization / Pharmacy */}
          <div className="space-y-2">
            <Label htmlFor="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization / Pharmacy Name
            </Label>
            <Input
              id="organization"
              placeholder="ABC Pharmacy"
              value={profileData.organization}
              onChange={(e) =>
                setProfileData({ ...profileData, organization: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Your affiliated healthcare organization or pharmacy
            </p>
          </div>

          {/* License Number */}
          <div className="space-y-2">
            <Label htmlFor="license_number" className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" />
              License Number
            </Label>
            <Input
              id="license_number"
              placeholder="e.g., MD12345678"
              value={profileData.license_number}
              onChange={(e) =>
                setProfileData({ ...profileData, license_number: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Your medical or pharmacy license number for credential tracking
            </p>
          </div>

          {/* License Expiration Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              License Expiration Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !profileData.license_expiration_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {profileData.license_expiration_date
                    ? format(parseISO(profileData.license_expiration_date), "PPP")
                    : "Select expiration date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={profileData.license_expiration_date ? parseISO(profileData.license_expiration_date) : undefined}
                  onSelect={(date) =>
                    setProfileData({
                      ...profileData,
                      license_expiration_date: date ? format(date, "yyyy-MM-dd") : null,
                    })
                  }
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {profileData.license_expiration_date && (() => {
              const daysUntilExpiry = differenceInDays(
                parseISO(profileData.license_expiration_date),
                new Date()
              );
              if (daysUntilExpiry < 0) {
                return (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    License has expired! Please renew immediately.
                  </div>
                );
              } else if (daysUntilExpiry <= 30) {
                return (
                  <div className="flex items-center gap-2 text-warning text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    License expires in {daysUntilExpiry} days. Renewal recommended.
                  </div>
                );
              } else if (daysUntilExpiry <= 90) {
                return (
                  <p className="text-xs text-muted-foreground">
                    License expires in {daysUntilExpiry} days. You'll receive reminders before expiration.
                  </p>
                );
              }
              return (
                <p className="text-xs text-muted-foreground">
                  License valid for {daysUntilExpiry} days. Reminders will be sent 90, 30, and 7 days before expiration.
                </p>
              );
            })()}
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Address
          </CardTitle>
          <CardDescription>
            Your mailing address for healthcare communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input
              id="address_line1"
              placeholder="123 Main Street"
              value={profileData.address_line1}
              onChange={(e) =>
                setProfileData({ ...profileData, address_line1: e.target.value })
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input
              id="address_line2"
              placeholder="Apt 4B"
              value={profileData.address_line2}
              onChange={(e) =>
                setProfileData({ ...profileData, address_line2: e.target.value })
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="New York"
                value={profileData.city}
                onChange={(e) =>
                  setProfileData({ ...profileData, city: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State / Province</Label>
              <Input
                id="state"
                placeholder="NY"
                value={profileData.state}
                onChange={(e) =>
                  setProfileData({ ...profileData, state: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                placeholder="10001"
                value={profileData.postal_code}
                onChange={(e) =>
                  setProfileData({ ...profileData, postal_code: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="United States"
                value={profileData.country}
                onChange={(e) =>
                  setProfileData({ ...profileData, country: e.target.value })
                }
              />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Address
          </Button>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Change Email
          </CardTitle>
          <CardDescription>
            Update your email address. A verification link will be sent to both your current and new email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>

          {emailSent ? (
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Verification emails have been sent. Please check both your current email ({user?.email}) 
                and your new email ({newEmail}) to complete the change. The links will expire in 24 hours.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new_email">New Email Address</Label>
                <Input
                  id="new_email"
                  type="email"
                  placeholder="Enter new email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <Button
                onClick={handleChangeEmail}
                disabled={savingEmail || !newEmail.trim()}
              >
                {savingEmail && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Verification Email
              </Button>
            </>
          )}

          {emailSent && (
            <Button
              variant="outline"
              onClick={() => {
                setEmailSent(false);
                setNewEmail("");
              }}
            >
              Change to Different Email
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showPasswords.new ? "text" : "password"}
                placeholder="Enter new password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() =>
                  setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                }
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showPasswords.confirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() =>
                  setShowPasswords({
                    ...showPasswords,
                    confirm: !showPasswords.confirm,
                  })
                }
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={
              savingPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword
            }
          >
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
