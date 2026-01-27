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
  FlaskConical,
  Plus,
  TrendingUp,
  Mail,
  Eye,
  MousePointerClick,
  Trophy,
  AlertCircle,
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

export function ABTestingPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTest, setNewTest] = useState({
    test_name: "",
    notification_type: "medication_reminder",
    variant_a_subject: "",
    variant_a_preview: "",
    variant_b_subject: "",
    variant_b_preview: "",
  });

  // Fetch all A/B tests using RPC or raw query
  const { data: tests, isLoading } = useQuery({
    queryKey: ["ab-tests"],
    queryFn: async () => {
      // Use raw fetch since tables aren't in types yet
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
      // Get assignments with notification history data
      const { data: assignments, error } = await supabase
        .from("email_ab_assignments" as any)
        .select(`
          test_id,
          variant,
          notification_id,
          notification_history(status, opened_at, clicked_at)
        `);

      if (error) throw error;

      // Aggregate results by test
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
          ...newTest,
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
      });
      toast.success("A/B test created successfully");
    },
    onError: (error) => {
      console.error("Failed to create test:", error);
      toast.error("Failed to create test");
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
      ? (results.variant_a_opened / results.variant_a_sent) * 100 
      : 0;
    const bOpenRate = results.variant_b_sent > 0 
      ? (results.variant_b_opened / results.variant_b_sent) * 100 
      : 0;

    if (results.variant_a_sent < 10 || results.variant_b_sent < 10) {
      return { winner: null, message: "Need more data" };
    }

    const diff = Math.abs(aOpenRate - bOpenRate);
    if (diff < 5) {
      return { winner: null, message: "No significant difference" };
    }

    return {
      winner: aOpenRate > bOpenRate ? "A" : "B",
      message: `${(aOpenRate > bOpenRate ? aOpenRate : bOpenRate).toFixed(1)}% open rate`,
    };
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
          <DialogContent className="sm:max-w-lg">
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

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Tests with Winner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tests?.filter((t) => {
                const results = getResultsForTest(t.id);
                return calculateWinner(results)?.winner;
              }).length || 0}
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
                        <CardDescription>
                          {NOTIFICATION_TYPES.find((t) => t.value === test.notification_type)?.label} •
                          Started {format(new Date(test.start_date), "MMM d, yyyy")}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {winner?.winner && (
                        <Badge className="gap-1" variant="default">
                          <Trophy className="h-3 w-3" />
                          Variant {winner.winner} wins
                        </Badge>
                      )}
                      <Switch
                        checked={test.is_active}
                        onCheckedChange={(checked) =>
                          toggleTestMutation.mutate({ id: test.id, is_active: checked })
                        }
                      />
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
                          <Trophy className="h-4 w-4 text-primary" />
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
                          <Trophy className="h-4 w-4 text-primary" />
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

                  {/* Progress comparison */}
                  {results && (results.variant_a_sent > 0 || results.variant_b_sent > 0) && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Open Rate Comparison</span>
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
