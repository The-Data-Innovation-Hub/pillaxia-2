import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, User, Stethoscope, Pill, Shield, Building2 } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile, roles, loading, signOut, isAdmin, isManager, isClinician, isPharmacist, isPatient, isAdminOrManager } = useAuth();

  const loginPath = "/";
  useEffect(() => {
    if (!loading && !user) {
      navigate(loginPath);
    }
  }, [user, loading, navigate, loginPath]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "manager":
        return <Building2 className="h-4 w-4" />;
      case "clinician":
        return <Stethoscope className="h-4 w-4" />;
      case "pharmacist":
        return <Pill className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "manager":
        return "bg-violet-500/10 text-violet-700 border-violet-500/20";
      case "clinician":
        return "bg-primary/10 text-primary border-primary/20";
      case "pharmacist":
        return "bg-accent/50 text-accent-foreground border-accent";
      default:
        return "bg-secondary text-secondary-foreground border-secondary";
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pillaxia-navy-light/5 via-background to-pillaxia-purple/5">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-pillaxia-cyan">Pillaxia</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.first_name || user.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">
            Welcome, {profile?.first_name || "User"}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Your personalized health dashboard
          </p>
        </div>

        {/* Role Badges */}
        <div className="flex flex-wrap gap-2 mb-8">
          {roles.map((role) => (
            <Badge
              key={role}
              variant="outline"
              className={`${getRoleBadgeColor(role)} flex items-center gap-1.5 px-3 py-1`}
            >
              {getRoleIcon(role)}
              <span className="capitalize">{role}</span>
            </Badge>
          ))}
        </div>

        {/* Dashboard Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Patient Card - Everyone has patient access */}
          {isPatient && (
            <Card className="shadow-pillaxia-card border-secondary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-pillaxia-purple" />
                  Patient Dashboard
                </CardTitle>
                <CardDescription>
                  Manage your medications and track your health
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Access your medication tracker, symptom diary, and connect with caregivers.
                </p>
                <Button className="w-full" disabled>
                  Coming in Phase 2
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Clinician Card */}
          {isClinician && (
            <Card className="shadow-pillaxia-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Clinician Dashboard
                </CardTitle>
                <CardDescription>
                  Monitor patients and manage treatments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  View patient roster, adherence monitoring, and prescribing tools.
                </p>
                <Button className="w-full" variant="outline" disabled>
                  Coming in Phase 3
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pharmacist Card */}
          {isPharmacist && (
            <Card className="shadow-pillaxia-card border-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-accent-foreground" />
                  Pharmacist Dashboard
                </CardTitle>
                <CardDescription>
                  Manage prescriptions and inventory
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Review prescriptions, manage stock, and process refills.
                </p>
                <Button className="w-full" variant="outline" disabled>
                  Coming in Phase 4
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Manager Card */}
          {isManager && !isAdmin && (
            <Card className="shadow-pillaxia-card border-violet-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-violet-600" />
                  Manager Dashboard
                </CardTitle>
                <CardDescription>
                  Manage your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage organization users, settings, and view analytics for your organization.
                </p>
                <Button className="w-full" variant="outline" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Admin Card */}
          {isAdmin && (
            <Card className="shadow-pillaxia-card border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  Admin Dashboard
                </CardTitle>
                <CardDescription>
                  System administration and user management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage users, view analytics, and configure system settings.
                </p>
                <Button className="w-full" variant="outline" disabled>
                  Coming in Phase 5
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Profile Summary */}
        <Card className="mt-8 shadow-pillaxia-card">
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-foreground">{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-foreground">
                  {profile?.first_name && profile?.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="text-foreground">{profile?.phone || "Not set"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Organization</p>
                <p className="text-foreground">{profile?.organization_id || "Not set"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
