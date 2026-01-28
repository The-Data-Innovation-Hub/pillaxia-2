import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BreachCheckResult {
  breached: boolean;
  count: number;
  message?: string;
  apiError?: boolean;
}

export function usePasswordBreachCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [breachResult, setBreachResult] = useState<BreachCheckResult | null>(null);

  const checkPassword = useCallback(async (password: string): Promise<BreachCheckResult> => {
    // Skip check for very short passwords (will fail validation anyway)
    if (!password || password.length < 6) {
      return { breached: false, count: 0 };
    }

    setIsChecking(true);
    setBreachResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('check-password-breach', {
        body: { password },
      });

      if (error) {
        console.error('Password breach check error:', error);
        // Fail open on error
        return { breached: false, count: 0, apiError: true };
      }

      const result: BreachCheckResult = {
        breached: data?.breached ?? false,
        count: data?.count ?? 0,
        message: data?.message,
        apiError: data?.apiError,
      };

      setBreachResult(result);
      return result;

    } catch (error) {
      console.error('Password breach check failed:', error);
      return { breached: false, count: 0, apiError: true };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setBreachResult(null);
  }, []);

  return {
    checkPassword,
    isChecking,
    breachResult,
    clearResult,
  };
}
