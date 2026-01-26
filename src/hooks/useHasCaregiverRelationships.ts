import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useHasCaregiverRelationships() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["caregiver-relationships-count", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { count, error } = await supabase
        .from("caregiver_invitations")
        .select("*", { count: "exact", head: true })
        .eq("caregiver_user_id", user.id)
        .eq("status", "accepted");

      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
