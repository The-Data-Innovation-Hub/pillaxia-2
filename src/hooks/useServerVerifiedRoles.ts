import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "patient" | "clinician" | "pharmacist" | "admin" | "manager";

interface ServerVerifiedRoles {
  roles: AppRole[];
  isAdmin: boolean;
  isManager: boolean;
  isClinician: boolean;
  isPharmacist: boolean;
  isPatient: boolean;
  verified: boolean;
  loading: boolean;
  error: string | null;
  verifyRoles: () => Promise<void>;
}

/**
 * Hook to get server-verified roles from the validate-session edge function.
 * This provides authoritative role information that cannot be manipulated client-side.
 */
export function useServerVerifiedRoles(): ServerVerifiedRoles {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFlags, setRoleFlags] = useState({
    isAdmin: false,
    isManager: false,
    isClinician: false,
    isPharmacist: false,
    isPatient: false,
  });

  const verifyRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        setVerified(false);
        setRoles([]);
        setRoleFlags({
          isAdmin: false,
          isManager: false,
          isClinician: false,
          isPharmacist: false,
          isPatient: false,
        });
        setLoading(false);
        return;
      }

      const { data, error: invokeError } = await supabase.functions.invoke(
        "validate-session",
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (invokeError) {
        console.error("[SERVER_ROLES] Error validating session:", invokeError);
        setError(invokeError.message);
        setVerified(false);
        setLoading(false);
        return;
      }

      if (data?.valid && data?.roles) {
        setRoles(data.roles);
        setRoleFlags({
          isAdmin: data.isAdmin ?? false,
          isManager: data.isManager ?? false,
          isClinician: data.isClinician ?? false,
          isPharmacist: data.isPharmacist ?? false,
          isPatient: data.isPatient ?? false,
        });
        setVerified(true);
      } else {
        setVerified(false);
        setRoles([]);
        setRoleFlags({
          isAdmin: false,
          isManager: false,
          isClinician: false,
          isPharmacist: false,
          isPatient: false,
        });
      }
    } catch (err) {
      console.error("[SERVER_ROLES] Exception:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setVerified(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyRoles();
  }, [verifyRoles]);

  return {
    roles,
    ...roleFlags,
    verified,
    loading,
    error,
    verifyRoles,
  };
}
