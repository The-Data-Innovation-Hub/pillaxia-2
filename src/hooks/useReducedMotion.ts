import { useState, useEffect } from "react";

/**
 * Hook to detect user's reduced motion preference.
 * Returns true if the user has requested reduced motion in their OS settings.
 * 
 * Use this to:
 * - Disable or simplify animations
 * - Replace motion with opacity/fade transitions
 * - Provide static alternatives to animated content
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    
    // Legacy browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return reducedMotion;
}
