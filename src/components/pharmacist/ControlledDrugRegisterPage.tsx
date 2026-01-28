import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Shield, 
  Plus, 
  Package, 
  FileText, 
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ClipboardList,
  Search
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { AddControlledDrugDialog } from "./AddControlledDrugDialog";
import { DispenseControlledDrugDialog } from "./DispenseControlledDrugDialog";
import { AdjustStockDialog } from "./AdjustStockDialog";

type DrugSchedule = "II" | "III" | "IV" | "V";

interface ControlledDrug {
  id: string;
  name: string;
  generic_name: string | null;
  schedule: DrugSchedule;
  form: string;
  strength: string;
  manufacturer: string | null;
  ndc_number: string | null;
  current_stock: number;
  minimum_stock: number;
  unit_of_measure: string;
  storage_location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DispensingRecord {
  id: string;
  controlled_drug_id: string;
  patient_name: string;
  patient_id: string | null;
  prescriber_name: string;
  prescriber_dea: string | null;
  prescription_number: string;
  quantity_dispensed: number;
  quantity_remaining: number;
  dispensing_pharmacist_id: string;
  witness_pharmacist_id: string | null;
  dispensed_at: string;
  notes: string | null;
  controlled_drugs?: { name: string; schedule: DrugSchedule };
}

interface AdjustmentRecord {
  id: string;
  controlled_drug_id: string;
  adjustment_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  invoice_number: string | null;
  supplier: string | null;
  reason: string;
  performed_by: string;
  witness_id: string | null;
  created_at: string;
  controlled_drugs?: { name: string };
}

export function ControlledDrugRegisterPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [addDrugOpen, setAddDrugOpen] = useState(false);
  const [dispenseOpen, setDispenseOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<ControlledDrug | null>(null);

  // Fetch controlled drugs inventory
  const { data: drugs = [], refetch: refetchDrugs } = useQuery({
    queryKey: ["controlled-drugs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controlled_drugs")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as ControlledDrug[];
    },
  });

  // Fetch dispensing records
  const { data: dispensingRecords = [], refetch: refetchDispensing } = useQuery({
    queryKey: ["controlled-drug-dispensing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controlled_drug_dispensing")
        .select("*, controlled_drugs(name, schedule)")
        .order("dispensed_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as DispensingRecord[];
    },
  });

  // Fetch adjustment records
  const { data: adjustmentRecords = [], refetch: refetchAdjustments } = useQuery({
    queryKey: ["controlled-drug-adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controlled_drug_adjustments")
        .select("*, controlled_drugs(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as AdjustmentRecord[];
    },
  });

  const refetchAll = () => {
    refetchDrugs();
    refetchDispensing();
    refetchAdjustments();
  };

  const filteredDrugs = drugs.filter(drug =>
    drug.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    drug.generic_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    drug.ndc_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockDrugs = drugs.filter(drug => drug.current_stock <= drug.minimum_stock);

  const getScheduleBadge = (schedule: DrugSchedule) => {
    const colors: Record<DrugSchedule, string> = {
      "II": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "III": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "IV": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      "V": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return <Badge className={colors[schedule]}>Schedule {schedule}</Badge>;
  };

  const handleDispense = (drug: ControlledDrug) => {
    setSelectedDrug(drug);
    setDispenseOpen(true);
  };

  const handleAdjust = (drug: ControlledDrug) => {
    setSelectedDrug(drug);
    setAdjustOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Controlled Drug Register
          </h1>
          <p className="text-muted-foreground mt-1">
            DEA-compliant inventory tracking and dispensing records
          </p>
        </div>
        <Button onClick={() => setAddDrugOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Controlled Drug
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{drugs.length}</div>
            <p className="text-xs text-muted-foreground">
              Active controlled substances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-destructive">{lowStockDrugs.length}</div>
            <p className="text-xs text-muted-foreground">
              Items below minimum threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Dispensing</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">
              {dispensingRecords.filter(r => 
                new Date(r.dispensed_at).toDateString() === new Date().toDateString()
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Prescriptions filled today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Schedule II Items</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">
              {drugs.filter(d => d.schedule === "II").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Highest control substances
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="dispensing" className="gap-2">
            <FileText className="h-4 w-4" />
            Dispensing Log
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Adjustments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Controlled Substances Inventory</CardTitle>
                  <CardDescription>
                    Current stock levels and product information
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or NDC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead>NDC</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrugs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No controlled drugs found. Add your first controlled substance to begin tracking.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDrugs.map((drug) => (
                      <TableRow key={drug.id} className={drug.current_stock <= drug.minimum_stock ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{drug.name}</p>
                            {drug.generic_name && (
                              <p className="text-xs text-muted-foreground">{drug.generic_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getScheduleBadge(drug.schedule)}</TableCell>
                        <TableCell>{drug.strength} {drug.form}</TableCell>
                        <TableCell className="font-mono text-sm">{drug.ndc_number || "—"}</TableCell>
                        <TableCell className="text-right">
                          <span className={drug.current_stock <= drug.minimum_stock ? "text-destructive font-bold" : ""}>
                            {drug.current_stock}
                          </span>
                          <span className="text-muted-foreground ml-1">{drug.unit_of_measure}</span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{drug.minimum_stock}</TableCell>
                        <TableCell>{drug.storage_location || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => handleDispense(drug)}>
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Dispense
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleAdjust(drug)}>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Adjust
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispensing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dispensing Log</CardTitle>
              <CardDescription>
                Complete record of all controlled substance dispensing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Drug</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Prescriber</TableHead>
                    <TableHead>Rx Number</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispensingRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No dispensing records yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dispensingRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(record.dispensed_at), "MM/dd/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.controlled_drugs?.name}</p>
                            {record.controlled_drugs?.schedule && getScheduleBadge(record.controlled_drugs.schedule)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{record.patient_name}</p>
                            {record.patient_id && (
                              <p className="text-xs text-muted-foreground">ID: {record.patient_id}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{record.prescriber_name}</p>
                            {record.prescriber_dea && (
                              <p className="text-xs text-muted-foreground">DEA: {record.prescriber_dea}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{record.prescription_number}</TableCell>
                        <TableCell className="text-right font-medium">{record.quantity_dispensed}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{record.quantity_remaining}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{record.notes || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjustments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Adjustments</CardTitle>
              <CardDescription>
                Record of all inventory adjustments (receipts, returns, losses, corrections)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Drug</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead>Invoice/Supplier</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustmentRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No adjustment records yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    adjustmentRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(record.created_at), "MM/dd/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium">{record.controlled_drugs?.name}</TableCell>
                        <TableCell>
                          <Badge variant={record.adjustment_type === "received" ? "default" : "secondary"}>
                            {record.adjustment_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {record.quantity > 0 ? `+${record.quantity}` : record.quantity}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{record.previous_stock}</TableCell>
                        <TableCell className="text-right">{record.new_stock}</TableCell>
                        <TableCell>
                          {record.invoice_number && <span className="font-mono text-sm">{record.invoice_number}</span>}
                          {record.supplier && <p className="text-xs text-muted-foreground">{record.supplier}</p>}
                          {!record.invoice_number && !record.supplier && "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{record.reason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddControlledDrugDialog
        open={addDrugOpen}
        onOpenChange={setAddDrugOpen}
        onSuccess={refetchAll}
      />

      {selectedDrug && (
        <>
          <DispenseControlledDrugDialog
            open={dispenseOpen}
            onOpenChange={setDispenseOpen}
            drug={selectedDrug}
            onSuccess={refetchAll}
          />
          <AdjustStockDialog
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
            drug={selectedDrug}
            onSuccess={refetchAll}
          />
        </>
      )}
    </div>
  );
}
