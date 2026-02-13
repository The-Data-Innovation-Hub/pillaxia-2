import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  isDeviceTrusted as apiIsDeviceTrusted,
  trustDevice as apiTrustDevice,
  revokeTrustedDevice,
  revokeAllTrustedDevices as apiRevokeAllTrustedDevices,
  listTrustedDevices,
} from "@/integrations/azure/data";

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

const generateDeviceToken = (): string => {
  const array = new Uint8Array(TOKEN_LENGTH / 2);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
};

const hashToken = async (token: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const getDeviceInfo = (): { browser: string; os: string; deviceName: string } => {
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Opera")) browser = "Opera";
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

  const getDeviceToken = useCallback((): string => {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      token = generateDeviceToken();
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
    return token;
  }, []);

  const checkDeviceTrust = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        const token = getDeviceToken();
        const tokenHash = await hashToken(token);
        return await apiIsDeviceTrusted(userId, tokenHash);
      } catch (error) {
        console.error("Error checking device trust:", error);
        return false;
      }
    },
    [getDeviceToken]
  );

  const trustDevice = useCallback(
    async (days = 30): Promise<boolean> => {
      if (!user) return false;
      try {
        const token = getDeviceToken();
        const tokenHash = await hashToken(token);
        const { browser, os, deviceName } = getDeviceInfo();
        await apiTrustDevice(user.id, tokenHash, {
          label: deviceName,
          browser,
          os,
          days,
        });
        setIsDeviceTrusted(true);
        return true;
      } catch (error) {
        console.error("Error trusting device:", error);
        return false;
      }
    },
    [user, getDeviceToken]
  );

  const fetchDevices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listTrustedDevices(user.id);
      const active = (data || []).filter(
        (d) => d.is_active !== false && new Date((d.expires_at as string) || 0) > new Date()
      ) as TrustedDevice[];
      active.sort(
        (a, b) =>
          new Date((b.last_used_at as string) || 0).getTime() -
          new Date((a.last_used_at as string) || 0).getTime()
      );
      setDevices(active);
    } catch (error) {
      console.error("Error fetching trusted devices:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const revokeDevice = useCallback(
    async (deviceId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        await revokeTrustedDevice(user.id, deviceId);
        await fetchDevices();
        return true;
      } catch (error) {
        console.error("Error revoking device:", error);
        return false;
      }
    },
    [user, fetchDevices]
  );

  const revokeAllDevices = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    try {
      const count = await apiRevokeAllTrustedDevices(user.id);
      localStorage.removeItem(DEVICE_TOKEN_KEY);
      setIsDeviceTrusted(false);
      setDevices([]);
      return count;
    } catch (error) {
      console.error("Error revoking all devices:", error);
      return 0;
    }
  }, [user]);

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
