import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  listOrganizationMembersByOrg,
  listProfilesByUserIds,
  updateOrganizationMember,
  addOrganizationMember,
} from "@/integrations/azure/data";

export interface OrganizationMemberWithProfile {
  id: string;
  organization_id: string;
  user_id: string;
  org_role: "owner" | "admin" | "member";
  is_active: boolean;
  joined_at: string | null;
  invited_by: string | null;
  invited_at: string | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export function useOrganizationMembers() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: members, isLoading, error } = useQuery({
    queryKey: ["organization-members", organization?.id],
    queryFn: async (): Promise<OrganizationMemberWithProfile[]> => {
      if (!organization?.id) return [];

      try {
        const membersData = await listOrganizationMembersByOrg(organization.id);
        if (!membersData || membersData.length === 0) return [];

        const sorted = [...membersData].sort((a, b) => {
          const aAt = (a.joined_at && new Date(a.joined_at).getTime()) || 0;
          const bAt = (b.joined_at && new Date(b.joined_at).getTime()) || 0;
          return bAt - aAt;
        });

        const userIds = sorted.map((m) => m.user_id as string);
        let profilesData: Array<Record<string, unknown>> = [];
        try {
          profilesData = await listProfilesByUserIds(userIds);
        } catch {
          // Permission or missing endpoint
        }
        const profilesMap = new Map(profilesData.map((p) => [p.user_id as string, p]));

        return sorted.map((member) => ({
          ...member,
          profile: profilesMap.get(member.user_id as string) as OrganizationMemberWithProfile["profile"],
        })) as OrganizationMemberWithProfile[];
      } catch (err) {
        if (err instanceof Error && (err.message?.includes("permission") || err.message?.includes("403"))) {
          return [];
        }
        throw err;
      }
    },
    enabled: !!organization?.id,
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: "owner" | "admin" | "member" }) => {
      await updateOrganizationMember(memberId, { org_role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", organization?.id] });
      toast.success("Member role updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update role", { description: error.message });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      await updateOrganizationMember(memberId, { is_active: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", organization?.id] });
      toast.success("Member removed from organization");
    },
    onError: (error: Error) => {
      toast.error("Failed to remove member", { description: error.message });
    },
  });

  const inviteMember = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "member" }) => {
      if (!organization?.id) throw new Error("No organization");
      await addOrganizationMember({
        organization_id: organization.id,
        user_id: userId,
        org_role: role,
        invited_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", organization?.id] });
      toast.success("Member added to organization");
    },
    onError: (error: Error) => {
      toast.error("Failed to add member", { description: error.message });
    },
  });

  const refetchMembers = () => {
    queryClient.invalidateQueries({ queryKey: ["organization-members", organization?.id] });
  };

  return {
    members: members || [],
    isLoading,
    error,
    updateMemberRole,
    removeMember,
    inviteMember,
    refetchMembers,
  };
}
