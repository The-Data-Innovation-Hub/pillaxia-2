import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FlaskConical,
  Plus,
  TrendingUp,
  Mail,
  Eye,
  MousePointerClick,
  Trophy,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Download,
  Calendar,
  BarChart3,
  CheckCircle2,
} from "lucide-react";

interface ABTest {
  id: string;
  test_name: string;
  notification_type: string;
  variant_a_subject: string;
  variant_a_preview: string | null;
  variant_b_subject: string;
  variant_b_preview: string | null;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

interface ABTestResults {
  test_id: string;
  variant_a_sent: number;
  variant_a_opened: number;
  variant_a_clicked: number;
  variant_b_sent: number;
  variant_b_opened: number;
  variant_b_clicked: number;
}

const NOTIFICATION_TYPES = [
  { value: "medication_reminder", label: "Medication Reminders" },
  { value: "missed_dose_alert", label: "Missed Dose Alerts" },
  { value: "daily_digest", label: "Daily Digest" },
  { value: "encouragement", label: "Encouragement Messages" },
  { value: "clinician_message", label: "Clinician Messages" },
];

// Statistical significance calculation using z-test for proportions
function calculateStatisticalSignificance(
  n1: number,
  p1: number,
  n2: number,
  p2: number
): { isSignificant: boolean; confidence: number; zScore: number } {
  if (n1 < 5 || n2 < 5) {
    return { isSignificant: false, confidence: 0, zScore: 0 };
  }

  const pooledP = (n1 * p1 + n2 * p2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));
  
  if (se === 0) {
    return { isSignificant: false, confidence: 0, zScore: 0 };
  }

  const zScore = Math.abs((p1 - p2) / se);
  
  // Z-score thresholds: 1.645 (90%), 1.96 (95%), 2.576 (99%)
  let confidence = 0;
  let isSignificant = false;
  
  if (zScore >= 2.576) {
    confidence = 99;
    isSignificant = true;
  } else if (zScore >= 1.96) {
    confidence = 95;
    isSignificant = true;
  } else if (zScore >= 1.645) {
    confidence = 90;
    isSignificant = true;
  } else {
    confidence = Math.min(89, Math.round(zScore * 45));
  }

  return { isSignificant, confidence, zScore };
}

export function ABTestingPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [newTest, setNewTest] = useState({
    test_name: "",
    notification_type: "medication_reminder",
    variant_a_subject: "",
    variant_a_preview: "",
    variant_b_subject: "",
    variant_b_preview: "",
    end_date: "",
  });
  const [editTest, setEditTest] = useState({
    id: "",
    test_name: "",
    notification_type: "medication_reminder",
    variant_a_subject: "",
    variant_a_preview: "",
    variant_b_subject: "",
    variant_b_preview: "",
    end_date: "",
  });

  // Fetch all A/B tests
  const { data: tests, isLoading } = useQuery({
    queryKey: ["ab-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_ab_tests" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ABTest[];
    },
  });

  // Fetch test results/stats
  const { data: testResults } = useQuery({
    queryKey: ["ab-test-results"],
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from("email_ab_assignments" as any)
        .select(`
          test_id,
          variant,
          notification_id,
          notification_history(status, opened_at, clicked_at)
        `);

      if (error) throw error;

      const results: Record<string, ABTestResults> = {};
      
      for (const assignment of (assignments || []) as any[]) {
        if (!results[assignment.test_id]) {
          results[assignment.test_id] = {
            test_id: assignment.test_id,
            variant_a_sent: 0,
            variant_a_opened: 0,
            variant_a_clicked: 0,
            variant_b_sent: 0,
            variant_b_opened: 0,
            variant_b_clicked: 0,
          };
        }

        const r = results[assignment.test_id];
        const history = assignment.notification_history;
        
        if (assignment.variant === "A") {
          r.variant_a_sent++;
          if (history?.opened_at) r.variant_a_opened++;
          if (history?.clicked_at) r.variant_a_clicked++;
        } else {
          r.variant_b_sent++;
          if (history?.opened_at) r.variant_b_opened++;
          if (history?.clicked_at) r.variant_b_clicked++;
        }
      }

      return Object.values(results);
    },
    enabled: !!tests?.length,
  });

  // Create new test
  const createTestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("email_ab_tests" as any)
        .insert({
          test_name: newTest.test_name,
          notification_type: newTest.notification_type,
          variant_a_subject: newTest.variant_a_subject,
          variant_a_preview: newTest.variant_a_preview || null,
          variant_b_subject: newTest.variant_b_subject,
          variant_b_preview: newTest.variant_b_preview || null,
          end_date: newTest.end_date ? new Date(newTest.end_date).toISOString() : null,
          is_active: true,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      setCreateDialogOpen(false);
      setNewTest({
        test_name: "",
        notification_type: "medication_reminder",
        variant_a_subject: "",
        variant_a_preview: "",
        variant_b_subject: "",
        variant_b_preview: "",
        end_date: "",
      });
      toast.success("A/B test created successfully");
    },
    onError: (error) => {
      console.error("Failed to create test:", error);
      toast.error("Failed to create test");
    },
  });

  // Update test
  const updateTestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("email_ab_tests" as any)
        .update({
          test_name: editTest.test_name,
          notification_type: editTest.notification_type,
          variant_a_subject: editTest.variant_a_subject,
          variant_a_preview: editTest.variant_a_preview || null,
          variant_b_subject: editTest.variant_b_subject,
          variant_b_preview: editTest.variant_b_preview || null,
          end_date: editTest.end_date ? new Date(editTest.end_date).toISOString() : null,
        } as any)
        .eq("id", editTest.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      setEditDialogOpen(false);
      toast.success("Test updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update test:", error);
      toast.error("Failed to update test");
    },
  });

  // Delete test
  const deleteTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      // First delete assignments
      await supabase
        .from("email_ab_assignments" as any)
        .delete()
        .eq("test_id", testId);

      // Then delete the test
      const { error } = await supabase
        .from("email_ab_tests" as any)
        .delete()
        .eq("id", testId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      queryClient.invalidateQueries({ queryKey: ["ab-test-results"] });
      setDeleteDialogOpen(false);
      setSelectedTest(null);
      toast.success("Test deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete test:", error);
      toast.error("Failed to delete test");
    },
  });

  // Duplicate test
  const duplicateTestMutation = useMutation({
    mutationFn: async (test: ABTest) => {
      const { error } = await supabase
        .from("email_ab_tests" as any)
        .insert({
          test_name: `${test.test_name} (Copy)`,
          notification_type: test.notification_type,
          variant_a_subject: test.variant_a_subject,
          variant_a_preview: test.variant_a_preview,
          variant_b_subject: test.variant_b_subject,
          variant_b_preview: test.variant_b_preview,
          is_active: false,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      toast.success("Test duplicated successfully");
    },
    onError: (error) => {
      console.error("Failed to duplicate test:", error);
      toast.error("Failed to duplicate test");
    },
  });

  // Toggle test active status
  const toggleTestMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("email_ab_tests" as any)
        .update({ is_active } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      toast.success("Test status updated");
    },
  });

  const getResultsForTest = (testId: string): ABTestResults | undefined => {
    return testResults?.find((r) => r.test_id === testId);
  };

  const calculateWinner = (results: ABTestResults | undefined) => {
    if (!results) return null;
    
    const aOpenRate = results.variant_a_sent > 0 
      ? results.variant_a_opened / results.variant_a_sent 
      : 0;
    const bOpenRate = results.variant_b_sent > 0 
      ? results.variant_b_opened / results.variant_b_sent 
      : 0;

    const stats = calculateStatisticalSignificance(
      results.variant_a_sent,
      aOpenRate,
      results.variant_b_sent,
      bOpenRate
    );

    if (!stats.isSignificant) {
      if (results.variant_a_sent < 30 || results.variant_b_sent < 30) {
        return { winner: null, message: "Need more data (min 30 each)", confidence: stats.confidence };
      }
      return { winner: null, message: `Not significant (${stats.confidence}% confidence)`, confidence: stats.confidence };
    }

    return {
      winner: aOpenRate > bOpenRate ? "A" : "B",
      message: `${stats.confidence}% confidence`,
      confidence: stats.confidence,
    };
  };

  const handleEdit = (test: ABTest) => {
    setEditTest({
      id: test.id,
      test_name: test.test_name,
      notification_type: test.notification_type,
      variant_a_subject: test.variant_a_subject,
      variant_a_preview: test.variant_a_preview || "",
      variant_b_subject: test.variant_b_subject,
      variant_b_preview: test.variant_b_preview || "",
      end_date: test.end_date ? format(new Date(test.end_date), "yyyy-MM-dd") : "",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (test: ABTest) => {
    setSelectedTest(test);
    setDeleteDialogOpen(true);
  };

  const exportResults = (test: ABTest) => {
    const results = getResultsForTest(test.id);
    const aOpenRate = results && results.variant_a_sent > 0
      ? (results.variant_a_opened / results.variant_a_sent) * 100
      : 0;
    const bOpenRate = results && results.variant_b_sent > 0
      ? (results.variant_b_opened / results.variant_b_sent) * 100
      : 0;
    const aClickRate = results && results.variant_a_sent > 0
      ? (results.variant_a_clicked / results.variant_a_sent) * 100
      : 0;
    const bClickRate = results && results.variant_b_sent > 0
      ? (results.variant_b_clicked / results.variant_b_sent) * 100
      : 0;

    const winner = calculateWinner(results);

    const csvContent = [
      ["A/B Test Results Export"],
      [""],
      ["Test Name", test.test_name],
      ["Notification Type", NOTIFICATION_TYPES.find(t => t.value === test.notification_type)?.label],
      ["Start Date", format(new Date(test.start_date), "MMM d, yyyy")],
      ["End Date", test.end_date ? format(new Date(test.end_date), "MMM d, yyyy") : "Ongoing"],
      ["Status", test.is_active ? "Active" : "Paused"],
      [""],
      ["Variant", "Subject Line", "Preview Text", "Sent", "Opened", "Open Rate", "Clicked", "Click Rate"],
      ["A", test.variant_a_subject, test.variant_a_preview || "", results?.variant_a_sent || 0, results?.variant_a_opened || 0, `${aOpenRate.toFixed(2)}%`, results?.variant_a_clicked || 0, `${aClickRate.toFixed(2)}%`],
      ["B", test.variant_b_subject, test.variant_b_preview || "", results?.variant_b_sent || 0, results?.variant_b_opened || 0, `${bOpenRate.toFixed(2)}%`, results?.variant_b_clicked || 0, `${bClickRate.toFixed(2)}%`],
      [""],
      ["Winner", winner?.winner ? `Variant ${winner.winner}` : "No winner yet"],
      ["Statistical Confidence", winner?.confidence ? `${winner.confidence}%` : "N/A"],
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ab-test-${test.test_name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Results exported to CSV");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground">Test email subject lines and content</p>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground">
            Optimize email engagement with subject line testing
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Test
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create A/B Test</DialogTitle>
              <DialogDescription>
                Set up a new email subject line test
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Test Name</Label>
                <Input
                  placeholder="e.g., Reminder urgency test"
                  value={newTest.test_name}
                  onChange={(e) => setNewTest({ ...newTest, test_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Notification Type</Label>
                  <Select
                    value={newTest.notification_type}
                    onValueChange={(v) => setNewTest({ ...newTest, notification_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFICATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    End Date (optional)
                  </Label>
                  <Input
                    type="date"
                    value={newTest.end_date}
                    onChange={(e) => setNewTest({ ...newTest, end_date: e.target.value })}
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">A</Badge>
                  <span className="text-sm font-medium">Variant A</span>
                </div>
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="⏰ Time for your medication!"
                    value={newTest.variant_a_subject}
                    onChange={(e) => setNewTest({ ...newTest, variant_a_subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preview Text (optional)</Label>
                  <Input
                    placeholder="Don't miss your scheduled dose"
                    value={newTest.variant_a_preview}
                    onChange={(e) => setNewTest({ ...newTest, variant_a_preview: e.target.value })}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">B</Badge>
                  <span className="text-sm font-medium">Variant B</span>
                </div>
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="🔔 Medication Reminder"
                    value={newTest.variant_b_subject}
                    onChange={(e) => setNewTest({ ...newTest, variant_b_subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preview Text (optional)</Label>
                  <Input
                    placeholder="Your health matters - take your meds"
                    value={newTest.variant_b_preview}
                    onChange={(e) => setNewTest({ ...newTest, variant_b_preview: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createTestMutation.mutate()}
                disabled={
                  !newTest.test_name ||
                  !newTest.variant_a_subject ||
                  !newTest.variant_b_subject ||
                  createTestMutation.isPending
                }
              >
                {createTestMutation.isPending ? "Creating..." : "Create Test"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit A/B Test</DialogTitle>
            <DialogDescription>
              Update test configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Test Name</Label>
              <Input
                value={editTest.test_name}
                onChange={(e) => setEditTest({ ...editTest, test_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Notification Type</Label>
                <Select
                  value={editTest.notification_type}
                  onValueChange={(v) => setEditTest({ ...editTest, notification_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  End Date
                </Label>
                <Input
                  type="date"
                  value={editTest.end_date}
                  onChange={(e) => setEditTest({ ...editTest, end_date: e.target.value })}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">A</Badge>
                <span className="text-sm font-medium">Variant A</span>
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={editTest.variant_a_subject}
                  onChange={(e) => setEditTest({ ...editTest, variant_a_subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Preview Text</Label>
                <Input
                  value={editTest.variant_a_preview}
                  onChange={(e) => setEditTest({ ...editTest, variant_a_preview: e.target.value })}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">B</Badge>
                <span className="text-sm font-medium">Variant B</span>
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={editTest.variant_b_subject}
                  onChange={(e) => setEditTest({ ...editTest, variant_b_subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Preview Text</Label>
                <Input
                  value={editTest.variant_b_preview}
                  onChange={(e) => setEditTest({ ...editTest, variant_b_preview: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateTestMutation.mutate()}
              disabled={
                !editTest.test_name ||
                !editTest.variant_a_subject ||
                !editTest.variant_b_subject ||
                updateTestMutation.isPending
              }
            >
              {updateTestMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete A/B Test?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedTest?.test_name}" and all its assignment data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedTest && deleteTestMutation.mutate(selectedTest.id)}
            >
              {deleteTestMutation.isPending ? "Deleting..." : "Delete Test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tests?.filter((t) => t.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Variants Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {testResults?.reduce(
                (acc, r) => acc + r.variant_a_sent + r.variant_b_sent,
                0
              ) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Statistically Significant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {tests?.filter((t) => {
                const results = getResultsForTest(t.id);
                const winner = calculateWinner(results);
                return winner?.winner && winner.confidence >= 95;
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Open Rate Lift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const lifts = tests?.map((t) => {
                  const r = getResultsForTest(t.id);
                  if (!r || r.variant_a_sent < 10 || r.variant_b_sent < 10) return null;
                  const aRate = r.variant_a_opened / r.variant_a_sent;
                  const bRate = r.variant_b_opened / r.variant_b_sent;
                  const baseRate = Math.min(aRate, bRate);
                  const winnerRate = Math.max(aRate, bRate);
                  return baseRate > 0 ? ((winnerRate - baseRate) / baseRate) * 100 : 0;
                }).filter(Boolean) as number[];
                
                if (lifts.length === 0) return "—";
                const avg = lifts.reduce((a, b) => a + b, 0) / lifts.length;
                return `+${avg.toFixed(1)}%`;
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tests List */}
      {tests?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No A/B tests yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first test to optimize email engagement
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tests?.map((test) => {
            const results = getResultsForTest(test.id);
            const winner = calculateWinner(results);
            const aOpenRate = results && results.variant_a_sent > 0
              ? (results.variant_a_opened / results.variant_a_sent) * 100
              : 0;
            const bOpenRate = results && results.variant_b_sent > 0
              ? (results.variant_b_opened / results.variant_b_sent) * 100
              : 0;

            return (
              <Card key={test.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FlaskConical className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{test.test_name}</CardTitle>
                        <CardDescription className="flex flex-wrap gap-x-2">
                          <span>{NOTIFICATION_TYPES.find((t) => t.value === test.notification_type)?.label}</span>
                          <span>•</span>
                          <span>Started {format(new Date(test.start_date), "MMM d, yyyy")}</span>
                          {test.end_date && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Ends {format(new Date(test.end_date), "MMM d, yyyy")}
                              </span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {winner?.winner && winner.confidence >= 95 && (
                        <Badge className="gap-1" variant="default">
                          <Trophy className="h-3 w-3" />
                          Variant {winner.winner} wins ({winner.confidence}%)
                        </Badge>
                      )}
                      {winner?.winner && winner.confidence < 95 && winner.confidence >= 90 && (
                        <Badge className="gap-1" variant="secondary">
                          <BarChart3 className="h-3 w-3" />
                          Variant {winner.winner} leading ({winner.confidence}%)
                        </Badge>
                      )}
                      <Switch
                        checked={test.is_active}
                        onCheckedChange={(checked) =>
                          toggleTestMutation.mutate({ id: test.id, is_active: checked })
                        }
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(test)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateTestMutation.mutate(test)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportResults(test)}>
                            <Download className="h-4 w-4 mr-2" />
                            Export Results
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(test)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Variant A */}
                    <div className={`p-4 rounded-lg border ${winner?.winner === "A" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline">Variant A</Badge>
                        {winner?.winner === "A" && (
                          <div className="flex items-center gap-1">
                            {winner.confidence >= 95 ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <Trophy className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        )}
                      </div>
                      <p className="font-medium mb-1">{test.variant_a_subject}</p>
                      {test.variant_a_preview && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {test.variant_a_preview}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span>{results?.variant_a_sent || 0} sent</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          <span>{aOpenRate.toFixed(1)}% open</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                          <span>{results?.variant_a_clicked || 0} clicks</span>
                        </div>
                      </div>
                    </div>

                    {/* Variant B */}
                    <div className={`p-4 rounded-lg border ${winner?.winner === "B" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="secondary">Variant B</Badge>
                        {winner?.winner === "B" && (
                          <div className="flex items-center gap-1">
                            {winner.confidence >= 95 ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <Trophy className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        )}
                      </div>
                      <p className="font-medium mb-1">{test.variant_b_subject}</p>
                      {test.variant_b_preview && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {test.variant_b_preview}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span>{results?.variant_b_sent || 0} sent</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          <span>{bOpenRate.toFixed(1)}% open</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                          <span>{results?.variant_b_clicked || 0} clicks</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress comparison with statistical significance */}
                  {results && (results.variant_a_sent > 0 || results.variant_b_sent > 0) && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Open Rate Comparison</span>
                        </div>
                        {winner && (
                          <Badge variant={winner.confidence >= 95 ? "default" : "secondary"} className="text-xs">
                            {winner.confidence >= 95 ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Statistically Significant</>
                            ) : (
                              winner.message
                            )}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-8">A</span>
                          <Progress value={aOpenRate} className="flex-1" />
                          <span className="text-xs w-12 text-right">{aOpenRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-8">B</span>
                          <Progress value={bOpenRate} className="flex-1" />
                          <span className="text-xs w-12 text-right">{bOpenRate.toFixed(1)}%</span>
                        </div>
                      </div>
                      {aOpenRate !== bOpenRate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {aOpenRate > bOpenRate ? "A" : "B"} is performing {Math.abs(aOpenRate - bOpenRate).toFixed(1)}% better
                          {winner?.confidence && winner.confidence < 95 && ` (need ${95 - winner.confidence}% more confidence)`}
                        </p>
                      )}
                    </div>
                  )}

                  {(!results || (results.variant_a_sent === 0 && results.variant_b_sent === 0)) && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">
                          No emails sent yet. Results will appear once notifications are sent.
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
