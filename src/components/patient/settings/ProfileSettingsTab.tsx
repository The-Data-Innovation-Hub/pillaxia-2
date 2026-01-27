import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
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
  Camera,
  Eye,
  EyeOff,
} from "lucide-react";

interface ProfileData {
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export function ProfileSettingsTab() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: "",
    last_name: "",
    phone: "",
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
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Load profile data on mount
  useEffect(() => {
    if (profile) {
      setProfileData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        avatar_url: profile.avatar_url || "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "",
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          avatar_url: data.avatar_url,
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
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
      
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
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
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profileData.avatar_url} alt="Profile" />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Profile Picture URL</Label>
              <div className="flex gap-2">
                <Input
                  id="avatar_url"
                  placeholder="https://example.com/avatar.jpg"
                  value={profileData.avatar_url}
                  onChange={(e) =>
                    setProfileData({ ...profileData, avatar_url: e.target.value })
                  }
                  className="w-64"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a URL for your profile picture
              </p>
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

          <p className="text-sm text-muted-foreground">
            Address storage coming soon. Changes here are not yet saved.
          </p>
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
