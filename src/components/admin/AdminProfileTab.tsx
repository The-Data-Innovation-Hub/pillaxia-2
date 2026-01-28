import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
import {
  User,
  Lock,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  X,
  Building2,
  Briefcase,
} from "lucide-react";

interface ProfileData {
  first_name: string;
  last_name: string;
  organization: string;
  job_title: string;
  avatar_url: string;
}

export function AdminProfileTab() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: "",
    last_name: "",
    organization: "",
    job_title: "",
    avatar_url: "",
  });
  
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile data on mount
  useEffect(() => {
    const loadFullProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, organization, job_title, avatar_url")
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
          organization: data.organization || "",
          job_title: data.job_title || "",
          avatar_url: data.avatar_url || "",
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
          organization: data.organization,
          job_title: data.job_title,
          avatar_url: data.avatar_url,
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshProfile();
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Please upload an image smaller than 5MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      if (profileData.avatar_url && profileData.avatar_url.includes('avatars')) {
        const oldPath = profileData.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfileData({ ...profileData, avatar_url: publicUrl });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshProfile();
      
      toast.success("Profile picture updated");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Upload failed: " + message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    
    setUploadingAvatar(true);
    try {
      if (profileData.avatar_url && profileData.avatar_url.includes('avatars')) {
        const oldPath = profileData.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfileData({ ...profileData, avatar_url: '' });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshProfile();
      
      toast.success("Profile picture removed");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Failed to remove avatar: " + message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      
      if (error) throw error;
      
      toast.success("Password updated successfully");
      
      setPasswordData({
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Failed to change password: " + message);
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
            Update your name, organization, and profile picture
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
                  id="admin-avatar-upload"
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

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={profileData.first_name}
                onChange={(e) =>
                  setProfileData({ ...profileData, first_name: e.target.value })
                }
                placeholder="Enter your first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={profileData.last_name}
                onChange={(e) =>
                  setProfileData({ ...profileData, last_name: e.target.value })
                }
                placeholder="Enter your last name"
              />
            </div>
          </div>

          {/* Organization */}
          <div className="space-y-2">
            <Label htmlFor="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </Label>
            <Input
              id="organization"
              value={profileData.organization}
              onChange={(e) =>
                setProfileData({ ...profileData, organization: e.target.value })
              }
              placeholder="Enter your organization name"
            />
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="job_title" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Job Title
            </Label>
            <Input
              id="job_title"
              value={profileData.job_title}
              onChange={(e) =>
                setProfileData({ ...profileData, job_title: e.target.value })
              }
              placeholder="Enter your job title"
            />
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="w-full sm:w-auto"
          >
            {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
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
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                placeholder="Enter new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() =>
                  setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                }
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
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
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                placeholder="Confirm new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() =>
                  setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                }
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={savingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {savingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
