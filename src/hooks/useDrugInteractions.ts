import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const checkInteractions = useCallback(async (newDrugName: string, existingDrugs: string[]) => {
    if (!newDrugName || existingDrugs.length === 0) {
      setInteractions([]);
      return [];
    }

    setLoading(true);
    try {
      const normalizedNew = newDrugName.toLowerCase().trim();
      const normalizedExisting = existingDrugs.map((d) => d.toLowerCase().trim());

      // Query for interactions where the new drug matches either drug_a or drug_b
      const { data, error } = await supabase
        .from("drug_interactions")
        .select("*");

      if (error) throw error;

      // Filter interactions that involve the new drug and any existing drug
      const foundInteractions = (data || []).filter((interaction) => {
        const drugA = interaction.drug_a.toLowerCase();
        const drugB = interaction.drug_b.toLowerCase();

        // Check if new drug matches drug_a or drug_b
        const newDrugMatches = 
          normalizedNew.includes(drugA) || 
          drugA.includes(normalizedNew) ||
          normalizedNew.includes(drugB) || 
          drugB.includes(normalizedNew);

        if (!newDrugMatches) return false;

        // Check if any existing drug matches the other drug in the pair
        const existingMatch = normalizedExisting.some((existing) => {
          if (normalizedNew.includes(drugA) || drugA.includes(normalizedNew)) {
            return existing.includes(drugB) || drugB.includes(existing);
          } else {
            return existing.includes(drugA) || drugA.includes(existing);
          }
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
  }, []);

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
