import { useState, useEffect } from "react";
import { db } from "@/integrations/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Clock, Search, Shield, XCircle } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";

interface ProfileWithLicense {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  license_number: string | null;
  license_expiration_date: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  organization_name: string | null;
  role: string;
}

type LicenseStatus = "all" | "expired" | "expiring-soon" | "valid" | "missing";

export function LicenseCompliancePage() {
  const [profiles, setProfiles] = useState<ProfileWithLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LicenseStatus>("all");

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      // Fetch profiles for clinicians and pharmacists
      const { data: rolesData, error: rolesError } = await db
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["clinician", "pharmacist"]);

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      const userIds = rolesData.map((r) => r.user_id);

      const { data: profilesData, error: profilesError } = await db
        .from("profiles")
        .select("user_id, first_name, last_name, email, license_number, license_expiration_date, avatar_url, organization_id, organizations (name)")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Merge profiles with roles
      const mergedProfiles: ProfileWithLicense[] = (profilesData || []).map((profile: any) => {
        const roleEntry = rolesData.find((r) => r.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          license_number: profile.license_number,
          license_expiration_date: profile.license_expiration_date,
          avatar_url: profile.avatar_url,
          organization_id: profile.organization_id,
          organization_name: profile.organizations?.name || null,
          role: roleEntry?.role || "unknown",
        };
      });

      setProfiles(mergedProfiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLicenseStatus = (expirationDate: string | null): { status: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ReactNode } => {
    if (!expirationDate) {
      return { status: "Not Set", variant: "secondary", icon: <Clock className="h-3 w-3" /> };
    }

    const daysUntil = differenceInDays(parseISO(expirationDate), new Date());

    if (daysUntil < 0) {
      return { status: "Expired", variant: "destructive", icon: <XCircle className="h-3 w-3" /> };
    }
    if (daysUntil <= 30) {
      return { status: `${daysUntil}d left`, variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> };
    }
    if (daysUntil <= 90) {
      return { status: `${daysUntil}d left`, variant: "outline", icon: <Clock className="h-3 w-3" /> };
    }
    return { status: "Valid", variant: "default", icon: <CheckCircle className="h-3 w-3" /> };
  };

  const filterProfiles = (profile: ProfileWithLicense): boolean => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      profile.first_name?.toLowerCase().includes(searchLower) ||
      profile.last_name?.toLowerCase().includes(searchLower) ||
      profile.email?.toLowerCase().includes(searchLower) ||
      profile.license_number?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Status filter
    if (statusFilter === "all") return true;

    const expirationDate = profile.license_expiration_date;

    if (statusFilter === "missing") {
      return !expirationDate || !profile.license_number;
    }

    if (!expirationDate) return false;

    const daysUntil = differenceInDays(parseISO(expirationDate), new Date());

    switch (statusFilter) {
      case "expired":
        return daysUntil < 0;
      case "expiring-soon":
        return daysUntil >= 0 && daysUntil <= 90;
      case "valid":
        return daysUntil > 90;
      default:
        return true;
    }
  };

  const filteredProfiles = profiles.filter(filterProfiles);

  // Statistics
  const stats = {
    total: profiles.length,
    expired: profiles.filter((p) => {
      if (!p.license_expiration_date) return false;
      return differenceInDays(parseISO(p.license_expiration_date), new Date()) < 0;
    }).length,
    expiringSoon: profiles.filter((p) => {
      if (!p.license_expiration_date) return false;
      const days = differenceInDays(parseISO(p.license_expiration_date), new Date());
      return days >= 0 && days <= 90;
    }).length,
    missing: profiles.filter((p) => !p.license_expiration_date || !p.license_number).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          License Compliance
        </h1>
        <p className="text-muted-foreground">
          Monitor professional license status for clinicians and pharmacists
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Professionals</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              Expired Licenses
            </CardDescription>
            <CardTitle className="text-3xl text-destructive">{stats.expired}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-warning/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-warning" />
              Expiring Soon (90d)
            </CardDescription>
            <CardTitle className="text-3xl text-warning">{stats.expiringSoon}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Missing License Info
            </CardDescription>
            <CardTitle className="text-3xl">{stats.missing}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Professional Licenses</CardTitle>
          <CardDescription>
            Review and track license expiration for all healthcare professionals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or license number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LicenseStatus)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="expiring-soon">Expiring Soon</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="missing">Missing Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professional</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>License Number</TableHead>
                  <TableHead>Expiration Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No professionals found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProfiles.map((profile) => {
                    const { status, variant, icon } = getLicenseStatus(profile.license_expiration_date);
                    return (
                      <TableRow key={profile.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={profile.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {profile.first_name?.[0] || "?"}
                                {profile.last_name?.[0] || ""}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {profile.first_name || "Unknown"} {profile.last_name || ""}
                              </p>
                              <p className="text-xs text-muted-foreground">{profile.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {profile.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {profile.license_number || (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {profile.license_expiration_date ? (
                            format(parseISO(profile.license_expiration_date), "MMM d, yyyy")
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant} className="flex items-center gap-1 w-fit">
                            {icon}
                            {status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
