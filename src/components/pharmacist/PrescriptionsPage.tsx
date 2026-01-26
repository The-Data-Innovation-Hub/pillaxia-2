import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Pill, User, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Prescription {
  id: string;
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  prescriber: string | null;
  pharmacy: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  refills_remaining: number | null;
  patient: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export function PrescriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ["all-prescriptions"],
    queryFn: async () => {
      // Get all medications with patient profiles
      const { data: medications, error } = await supabase
        .from("medications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(medications?.map((m) => m.user_id) || [])];

      // Fetch profiles for all users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      // Map medications with patient info
      const prescriptionsWithPatients: Prescription[] = (medications || []).map((med) => {
        const profile = profiles?.find((p) => p.user_id === med.user_id);
        return {
          ...med,
          patient: profile
            ? {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
              }
            : null,
        };
      });

      return prescriptionsWithPatients;
    },
  });

  const filteredPrescriptions = prescriptions?.filter((rx) => {
    const matchesSearch =
      searchQuery === "" ||
      rx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${rx.patient?.first_name || ""} ${rx.patient?.last_name || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && rx.is_active) ||
      (statusFilter === "inactive" && !rx.is_active);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prescription Management</h1>
        <p className="text-muted-foreground">View and manage all patient prescriptions</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>All Prescriptions</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient or medication..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredPrescriptions?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No prescriptions match your search" : "No prescriptions found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medication</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Prescriber</TableHead>
                    <TableHead>Refills</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map((rx) => (
                    <TableRow key={rx.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Pill className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{rx.name}</p>
                            <p className="text-xs text-muted-foreground">{rx.form}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {rx.patient?.first_name} {rx.patient?.last_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rx.dosage} {rx.dosage_unit}
                      </TableCell>
                      <TableCell>{rx.prescriber || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (rx.refills_remaining || 0) === 0
                              ? "destructive"
                              : (rx.refills_remaining || 0) <= 2
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {rx.refills_remaining ?? 0} left
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rx.is_active ? "default" : "secondary"}>
                          {rx.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
