import { useState, useEffect } from "react";
import { Building2, Plus, Eye, Users, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/integrations/db";
import { toast } from "sonner";
import type { Organization } from "@/contexts/OrganizationContext";

export function PlatformOrganizationsList() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await db
        .from("organizations")
        .select("*")
        .order("name");

      if (error) throw error;

      setOrganizations((data || []) as Organization[]);

      // Fetch member counts for each organization
      if (data) {
        const counts: Record<string, number> = {};
        await Promise.all(
          data.map(async (org) => {
            const { count } = await db
              .from("organization_members")
              .select("*", { count: "exact", head: true })
              .eq("organization_id", org.id)
              .eq("is_active", true);
            counts[org.id] = count || 0;
          })
        );
        setMemberCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to load organizations");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-600 border-green-200";
      case "trial":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "suspended":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-200";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-200";
    }
  };

  const getLicenseColor = (license: string) => {
    switch (license?.toLowerCase()) {
      case "enterprise":
        return "bg-purple-500/10 text-purple-600 border-purple-200";
      case "premium":
        return "bg-indigo-500/10 text-indigo-600 border-indigo-200";
      case "standard":
        return "bg-cyan-500/10 text-cyan-600 border-cyan-200";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Platform Organizations</h1>
            <p className="text-muted-foreground">
              Manage all organizations across the platform
            </p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organizations Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first organization to get started with multi-tenancy.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {org.slug}
                    </CardDescription>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {org.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {org.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getStatusColor(org.status)}>
                    {org.status}
                  </Badge>
                  <Badge variant="outline" className={getLicenseColor(org.license_type || "")}>
                    {org.license_type || "standard"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {memberCounts[org.id] || 0} / {org.max_users || "∞"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium truncate">
                      {org.city || "—"}
                    </p>
                  </div>
                </div>

                <Button variant="outline" className="w-full" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Platform Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Organizations</p>
              <p className="text-2xl font-bold">{organizations.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">
                {organizations.filter((o) => o.status === "active").length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trial</p>
              <p className="text-2xl font-bold text-blue-600">
                {organizations.filter((o) => o.status === "trial").length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold">
                {Object.values(memberCounts).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
