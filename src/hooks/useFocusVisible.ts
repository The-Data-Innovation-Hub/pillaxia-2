import { useState, useEffect, useCallback } from "react";

/**
 * Hook to track whether the user is navigating via keyboard.
 * Returns true when focus should be visually indicated (keyboard navigation).
 * Returns false when using mouse/touch (to avoid distracting focus rings on click).
 * 
 * Use this to enhance focus indicator visibility only during keyboard navigation.
 */
export function useFocusVisible(): boolean {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Tab") {
      setIsKeyboardUser(true);
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsKeyboardUser(false);
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [handleKeyDown, handleMouseDown]);

  return isKeyboardUser;
}
