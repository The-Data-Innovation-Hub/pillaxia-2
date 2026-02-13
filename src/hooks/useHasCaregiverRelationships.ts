import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listCaregiverInvitations } from "@/integrations/azure/data";

export function useHasCaregiverRelationships() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["caregiver-relationships-count", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const list = await listCaregiverInvitations({
        caregiver_user_id: user.id,
        status: "accepted",
      });
      return (list?.length ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}
