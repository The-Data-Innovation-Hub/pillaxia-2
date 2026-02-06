/**
 * Hook to get server-verified roles.
 * Roles are loaded from the API via AuthContext and are already server-verified.
 */
import { useAuth } from "@/contexts/AuthContext";

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

export function useServerVerifiedRoles(): ServerVerifiedRoles {
  const auth = useAuth();
  const roles = (auth.roles ?? []) as AppRole[];

  return {
    roles,
    isAdmin: auth.isAdmin ?? false,
    isManager: auth.isManager ?? false,
    isClinician: auth.isClinician ?? false,
    isPharmacist: auth.isPharmacist ?? false,
    isPatient: auth.isPatient || roles.includes("patient"),
    verified: !auth.loading && !!auth.user,
    loading: auth.loading,
    error: null,
    verifyRoles: async () => {
      await auth.refreshProfile();
    },
  };
}
