import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";

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

      // Fetch members - RLS now restricts to managers/admins/org admins or own membership
      // Regular members will only see their own membership record
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", organization.id)
        .order("joined_at", { ascending: false });

      if (membersError) {
        // If access denied, return empty - user doesn't have permission to view members
        if (membersError.code === 'PGRST301' || membersError.message?.includes('permission')) {
          console.info('User does not have permission to view all organization members');
          return [];
        }
        throw membersError;
      }
      if (!membersData || membersData.length === 0) return [];

      // Fetch profiles for all member user_ids
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, avatar_url")
        .in("user_id", userIds);

      // Map profiles to members
      const profilesMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );

      return membersData.map(member => ({
        ...member,
        profile: profilesMap.get(member.user_id) || undefined,
      })) as OrganizationMemberWithProfile[];
    },
    enabled: !!organization?.id,
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: "owner" | "admin" | "member" }) => {
      const { error } = await supabase
        .from("organization_members")
        .update({ org_role: newRole })
        .eq("id", memberId);

      if (error) throw error;
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
      const { error } = await supabase
        .from("organization_members")
        .update({ is_active: false })
        .eq("id", memberId);

      if (error) throw error;
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

      const { error } = await supabase
        .from("organization_members")
        .insert({
          organization_id: organization.id,
          user_id: userId,
          org_role: role,
          invited_at: new Date().toISOString(),
        });

      if (error) throw error;
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
