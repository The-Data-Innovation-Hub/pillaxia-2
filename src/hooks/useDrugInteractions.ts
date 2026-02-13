import { useState, useCallback } from "react";
import { listDrugInteractions } from "@/integrations/azure/data";

export interface DrugInteraction {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: "mild" | "moderate" | "severe" | "contraindicated";
  description: string;
  recommendation: string | null;
}

export function useDrugInteractions() {
  const [loading, setLoading] = useState(false);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);

  const checkInteractions = useCallback(
    async (newDrugName: string, existingDrugs: string[]) => {
      if (!newDrugName || existingDrugs.length === 0) {
        setInteractions([]);
        return [];
      }

      setLoading(true);
      try {
        const normalizedNew = newDrugName.toLowerCase().trim();
        const normalizedExisting = existingDrugs.map((d) => d.toLowerCase().trim());

        const data = await listDrugInteractions();

        const foundInteractions = (data || []).filter((interaction) => {
          const drugA = String(interaction.drug_a || "").toLowerCase();
          const drugB = String(interaction.drug_b || "").toLowerCase();

          const newDrugMatches =
            normalizedNew.includes(drugA) ||
            drugA.includes(normalizedNew) ||
            normalizedNew.includes(drugB) ||
            drugB.includes(normalizedNew);

          if (!newDrugMatches) return false;

          const existingMatch = normalizedExisting.some((existing) => {
            if (normalizedNew.includes(drugA) || drugA.includes(normalizedNew)) {
              return existing.includes(drugB) || drugB.includes(existing);
            }
            return existing.includes(drugA) || drugA.includes(existing);
          });

          return existingMatch;
        }) as DrugInteraction[];

        setInteractions(foundInteractions);
        return foundInteractions;
      } catch (error) {
        console.error("Error checking drug interactions:", error);
        setInteractions([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearInteractions = useCallback(() => {
    setInteractions([]);
  }, []);

  return {
    loading,
    interactions,
    checkInteractions,
    clearInteractions,
  };
}
