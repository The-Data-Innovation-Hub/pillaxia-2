import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TrustedDevice {
  id: string;
  device_name: string | null;
  browser: string | null;
  operating_system: string | null;
  ip_address: string | null;
  trusted_at: string;
  expires_at: string;
  last_used_at: string;
  is_active: boolean;
}

const DEVICE_TOKEN_KEY = "pillaxia_device_token";
const TOKEN_LENGTH = 64;

// Generate a cryptographically secure random token
const generateDeviceToken = (): string => {
  const array = new Uint8Array(TOKEN_LENGTH / 2);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
};

// Hash the token for storage in database
const hashToken = async (token: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Get browser and OS info
const getDeviceInfo = (): { browser: string; os: string; deviceName: string } => {
  const ua = navigator.userAgent;
  
  // Detect browser
  let browser = "Unknown Browser";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Opera")) browser = "Opera";
  
  // Detect OS
  let os = "Unknown OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  
  const deviceName = `${browser} on ${os}`;
  
  return { browser, os, deviceName };
};

export function useTrustedDevices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeviceTrusted, setIsDeviceTrusted] = useState<boolean | null>(null);

  // Get or create device token from localStorage
  const getDeviceToken = useCallback((): string => {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      token = generateDeviceToken();
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
    return token;
  }, []);

  // Check if current device is trusted for a specific user
  const checkDeviceTrust = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const token = getDeviceToken();
      const tokenHash = await hashToken(token);
      
      const { data, error } = await supabase.rpc("is_device_trusted", {
        p_user_id: userId,
        p_device_token_hash: tokenHash,
      });
      
      if (error) {
        console.error("Error checking device trust:", error);
        return false;
      }
      
      return data === true;
    } catch (error) {
      console.error("Error checking device trust:", error);
      return false;
    }
  }, [getDeviceToken]);

  // Trust the current device
  const trustDevice = useCallback(async (days = 30): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const token = getDeviceToken();
      const tokenHash = await hashToken(token);
      const { browser, os, deviceName } = getDeviceInfo();
      
      const { data, error } = await supabase.rpc("trust_device", {
        p_user_id: user.id,
        p_device_token_hash: tokenHash,
        p_device_name: deviceName,
        p_browser: browser,
        p_os: os,
        p_ip: null, // IP will be captured server-side if needed
        p_days: days,
      });
      
      if (error) {
        console.error("Error trusting device:", error);
        return false;
      }
      
      setIsDeviceTrusted(true);
      return true;
    } catch (error) {
      console.error("Error trusting device:", error);
      return false;
    }
  }, [user, getDeviceToken]);

  // Revoke a specific trusted device
  const revokeDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("revoke_trusted_device", {
        p_device_id: deviceId,
      });
      
      if (error) {
        console.error("Error revoking device:", error);
        return false;
      }
      
      // Refresh devices list
      await fetchDevices();
      return true;
    } catch (error) {
      console.error("Error revoking device:", error);
      return false;
    }
  }, []);

  // Revoke all trusted devices
  const revokeAllDevices = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    
    try {
      const { data, error } = await supabase.rpc("revoke_all_trusted_devices", {
        p_user_id: user.id,
      });
      
      if (error) {
        console.error("Error revoking all devices:", error);
        return 0;
      }
      
      // Clear local token
      localStorage.removeItem(DEVICE_TOKEN_KEY);
      setIsDeviceTrusted(false);
      setDevices([]);
      
      return data || 0;
    } catch (error) {
      console.error("Error revoking all devices:", error);
      return 0;
    }
  }, [user]);

  // Fetch all trusted devices for the user
  const fetchDevices = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trusted_devices")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("last_used_at", { ascending: false });
      
      if (error) throw error;
      
      setDevices(data || []);
    } catch (error) {
      console.error("Error fetching trusted devices:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check current device trust status on mount
  useEffect(() => {
    if (user) {
      checkDeviceTrust(user.id).then(setIsDeviceTrusted);
      fetchDevices();
    }
  }, [user, checkDeviceTrust, fetchDevices]);

  return {
    devices,
    loading,
    isDeviceTrusted,
    checkDeviceTrust,
    trustDevice,
    revokeDevice,
    revokeAllDevices,
    fetchDevices,
    getDeviceToken,
  };
}
