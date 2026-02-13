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

/**
 * Server-verified roles from AuthContext (sourced from backend /api/me with Azure token).
 * Roles are considered verified because they are returned by the backend after validating the token.
 */
export function useServerVerifiedRoles(): ServerVerifiedRoles {
  const { session, roles, loading } = useAuth();
  const verified = !!session && roles.length > 0;

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("manager"),
    isClinician: roles.includes("clinician"),
    isPharmacist: roles.includes("pharmacist"),
    isPatient: roles.includes("patient"),
    verified,
    loading,
    error: null,
    verifyRoles: async () => {},
  };
}
