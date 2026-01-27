import { supabase } from "@/integrations/supabase/client";

let cachedVapidPublicKey: string | null = null;

/**
 * Returns the Web Push VAPID public key.
 *
 * Priority:
 * 1) Vite env var (VITE_VAPID_PUBLIC_KEY) if provided
 * 2) Backend function `get-vapid-public-key` (reads from server secrets)
 */
export async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;

  const fromEnv = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (fromEnv && fromEnv.trim().length > 0) {
    cachedVapidPublicKey = fromEnv.trim();
    return cachedVapidPublicKey;
  }

  const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
  if (error) throw error;

  const key = (data as { publicKey?: string } | null)?.publicKey;
  if (!key) {
    throw new Error("VAPID public key not configured");
  }

  cachedVapidPublicKey = key;
  return key;
}
