import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Package, AlertTriangle, CheckCircle, TrendingDown } from "lucide-react";

interface InventoryItem {
  name: string;
  form: string;
  dosage: string;
  dosage_unit: string;
  totalPrescriptions: number;
  lowRefillCount: number;
  noRefillCount: number;
  stockLevel: "good" | "low" | "critical";
}

export function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["pharmacy-inventory"],
    queryFn: async () => {
      const { data: medications } = await supabase
        .from("medications")
        .select("name, form, dosage, dosage_unit, refills_remaining, is_active")
        .eq("is_active", true);

      if (!medications?.length) return [];

      // Group by medication name and aggregate
      const inventoryMap = new Map<string, InventoryItem>();

      medications.forEach((med) => {
        const key = `${med.name}-${med.dosage}-${med.dosage_unit}`;
        const existing = inventoryMap.get(key);

        if (existing) {
          existing.totalPrescriptions++;
          if ((med.refills_remaining || 0) <= 2 && (med.refills_remaining || 0) > 0) {
            existing.lowRefillCount++;
          }
          if ((med.refills_remaining || 0) === 0) {
            existing.noRefillCount++;
          }
        } else {
          inventoryMap.set(key, {
            name: med.name,
            form: med.form,
            dosage: med.dosage,
            dosage_unit: med.dosage_unit,
            totalPrescriptions: 1,
            lowRefillCount: (med.refills_remaining || 0) <= 2 && (med.refills_remaining || 0) > 0 ? 1 : 0,
            noRefillCount: (med.refills_remaining || 0) === 0 ? 1 : 0,
            stockLevel: "good",
          });
        }
      });

      // Calculate stock level
      const items = Array.from(inventoryMap.values()).map((item) => {
        const criticalRatio = item.noRefillCount / item.totalPrescriptions;
        const lowRatio = (item.lowRefillCount + item.noRefillCount) / item.totalPrescriptions;

        if (criticalRatio > 0.3) {
          item.stockLevel = "critical";
        } else if (lowRatio > 0.3) {
          item.stockLevel = "low";
        } else {
          item.stockLevel = "good";
        }
        return item;
      });

      return items.sort((a, b) => {
        const order = { critical: 0, low: 1, good: 2 };
        return order[a.stockLevel] - order[b.stockLevel];
      });
    },
  });

  const filteredInventory = inventory?.filter((item) => {
    const matchesSearch =
      searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStock =
      stockFilter === "all" ||
      item.stockLevel === stockFilter;

    return matchesSearch && matchesStock;
  });

  const stats = {
    total: inventory?.length || 0,
    critical: inventory?.filter((i) => i.stockLevel === "critical").length || 0,
    low: inventory?.filter((i) => i.stockLevel === "low").length || 0,
    good: inventory?.filter((i) => i.stockLevel === "good").length || 0,
  };

  const getStockBadge = (level: "good" | "low" | "critical") => {
    const config = {
      good: { variant: "outline" as const, icon: CheckCircle, label: "Good", className: "text-green-600" },
      low: { variant: "secondary" as const, icon: TrendingDown, label: "Low", className: "text-amber-600" },
      critical: { variant: "destructive" as const, icon: AlertTriangle, label: "Critical", className: "" },
    };
    const { variant, icon: Icon, label, className } = config[level];
    return (
      <Badge variant={variant} className={`gap-1 ${className}`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Tracking</h1>
        <p className="text-muted-foreground">Monitor medication stock levels and refill needs</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <TrendingDown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-amber-600">{stats.low}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Good Stock</p>
                <p className="text-2xl font-bold text-green-600">{stats.good}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Medication Inventory</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search medications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="good">Good Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !filteredInventory?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No items match your search" : "No inventory data available"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInventory.map((item, idx) => {
                const stockPercent =
                  ((item.totalPrescriptions - item.noRefillCount) / item.totalPrescriptions) * 100;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Package className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.dosage} {item.dosage_unit} • {item.form}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Prescriptions: </span>
                        <span className="font-medium">{item.totalPrescriptions}</span>
                      </div>
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Stock Health</span>
                          <span>{Math.round(stockPercent)}%</span>
                        </div>
                        <Progress
                          value={stockPercent}
                          className={`h-2 ${
                            item.stockLevel === "critical"
                              ? "[&>div]:bg-red-500"
                              : item.stockLevel === "low"
                              ? "[&>div]:bg-amber-500"
                              : "[&>div]:bg-green-500"
                          }`}
                        />
                      </div>
                      {getStockBadge(item.stockLevel)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
