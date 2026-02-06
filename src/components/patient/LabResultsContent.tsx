// Content extracted from LabResultsPage for use in tabbed interface
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { FileText, Search, AlertTriangle, CheckCircle, Clock, Download, Filter } from "lucide-react";

interface LabResult {
  id: string;
  user_id: string;
  ordered_by: string | null;
  test_name: string;
  test_code: string | null;
  category: string;
  result_value: string;
  result_unit: string | null;
  reference_range: string | null;
  status: string;
  is_abnormal: boolean;
  abnormal_flag: string | null;
  ordered_at: string;
  collected_at: string | null;
  resulted_at: string | null;
  lab_name: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
}

export function LabResultsContent() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: labResults, isLoading } = useQuery({
    queryKey: ["lab-results", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("lab_results")
        .select("*")
        .eq("user_id", user?.id)
        .order("ordered_at", { ascending: false });
      
      if (error) throw error;
      return data as LabResult[];
    },
    enabled: !!user?.id,
  });

  const categories = [...new Set(labResults?.map((r) => r.category) || [])];
  
  const filteredResults = labResults?.filter((result) => {
    const matchesSearch = result.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.result_value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || result.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || result.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const pendingCount = labResults?.filter((r) => r.status === "pending").length || 0;
  const abnormalCount = labResults?.filter((r) => r.is_abnormal).length || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case "pending":
        return <Clock className="h-4 w-4 text-secondary-foreground" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAbnormalBadge = (result: LabResult) => {
    if (!result.is_abnormal) return null;
    const variant = result.abnormal_flag === "critical" ? "destructive" : "secondary";
    return (
      <Badge variant={variant} className="ml-2">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {result.abnormal_flag?.toUpperCase() || "ABNORMAL"}
      </Badge>
    );
  };

  const groupByCategory = (results: LabResult[]) => {
    return results.reduce((acc, result) => {
      if (!acc[result.category]) acc[result.category] = [];
      acc[result.category].push(result);
      return acc;
    }, {} as Record<string, LabResult[]>);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{labResults?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Results</CardTitle>
            <Clock className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abnormal Results</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{abnormalCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="grouped">By Category</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading lab results...
              </CardContent>
            </Card>
          ) : !filteredResults?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {labResults?.length ? "No results match your filters" : "No lab results found"}
              </CardContent>
            </Card>
          ) : (
            filteredResults.map((result) => (
              <Card key={result.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        {getStatusIcon(result.status)}
                        <h3 className="font-semibold ml-2">{result.test_name}</h3>
                        {getAbnormalBadge(result)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Category: {result.category}</span>
                        {result.test_code && <span>Code: {result.test_code}</span>}
                        {result.lab_name && <span>Lab: {result.lab_name}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Ordered: {format(new Date(result.ordered_at), "MMM d, yyyy")}
                      </p>
                      {result.resulted_at && (
                        <p className="text-sm text-muted-foreground">
                          Resulted: {format(new Date(result.resulted_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>

                  {result.status === "completed" && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Result</p>
                          <p className={`font-semibold ${result.is_abnormal ? "text-destructive" : ""}`}>
                            {result.result_value} {result.result_unit}
                          </p>
                        </div>
                        {result.reference_range && (
                          <div>
                            <p className="text-xs text-muted-foreground">Reference Range</p>
                            <p className="font-medium">{result.reference_range}</p>
                          </div>
                        )}
                      </div>
                      {result.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{result.notes}</p>
                      )}
                    </div>
                  )}

                  {result.attachment_url && (
                    <Button variant="outline" size="sm" className="mt-4">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="grouped" className="space-y-6">
          {filteredResults && Object.entries(groupByCategory(filteredResults)).map(([category, results]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="capitalize">{category}</CardTitle>
                <CardDescription>{results.length} test(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center">
                        {getStatusIcon(result.status)}
                        <span className="ml-2 font-medium">{result.test_name}</span>
                        {getAbnormalBadge(result)}
                      </div>
                      <div className="text-right">
                        {result.status === "completed" ? (
                          <span className={result.is_abnormal ? "text-destructive font-semibold" : ""}>
                            {result.result_value} {result.result_unit}
                          </span>
                        ) : (
                          <Badge variant="secondary">{result.status}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
