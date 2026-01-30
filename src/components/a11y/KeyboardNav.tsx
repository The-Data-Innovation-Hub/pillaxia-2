/**
 * KeyboardNav Component & Hook
 * Provides keyboard navigation patterns for lists, grids, and menus.
 */
import * as React from "react";

export type NavigationPattern = "vertical" | "horizontal" | "grid" | "both";

interface KeyboardNavOptions {
  /** Navigation pattern to use */
  pattern?: NavigationPattern;
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Number of columns (for grid pattern) */
  columns?: number;
  /** Callback when an item is selected (Enter/Space) */
  onSelect?: (index: number) => void;
  /** Callback when focus changes */
  onFocusChange?: (index: number) => void;
}

interface KeyboardNavState {
  /** Currently focused index */
  focusedIndex: number;
  /** Set focused index */
  setFocusedIndex: (index: number) => void;
  /** Key down handler to attach to container */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Get props for an item at a given index */
  getItemProps: (index: number) => {
    tabIndex: number;
    "aria-selected": boolean;
    onFocus: () => void;
  };
}

/**
 * Hook for managing keyboard navigation in lists and grids.
 */
export function useKeyboardNav(
  itemCount: number,
  options: KeyboardNavOptions = {}
): KeyboardNavState {
  const {
    pattern = "vertical",
    wrap = true,
    columns = 1,
    onSelect,
    onFocusChange,
  } = options;

  const [focusedIndex, setFocusedIndex] = React.useState(0);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (itemCount === 0) return;

      let newIndex = focusedIndex;
      let handled = false;

      switch (e.key) {
        case "ArrowUp":
          if (pattern === "vertical" || pattern === "both" || pattern === "grid") {
            if (pattern === "grid") {
              newIndex = focusedIndex - columns;
            } else {
              newIndex = focusedIndex - 1;
            }
            handled = true;
          }
          break;

        case "ArrowDown":
          if (pattern === "vertical" || pattern === "both" || pattern === "grid") {
            if (pattern === "grid") {
              newIndex = focusedIndex + columns;
            } else {
              newIndex = focusedIndex + 1;
            }
            handled = true;
          }
          break;

        case "ArrowLeft":
          if (pattern === "horizontal" || pattern === "both" || pattern === "grid") {
            newIndex = focusedIndex - 1;
            handled = true;
          }
          break;

        case "ArrowRight":
          if (pattern === "horizontal" || pattern === "both" || pattern === "grid") {
            newIndex = focusedIndex + 1;
            handled = true;
          }
          break;

        case "Home":
          newIndex = 0;
          handled = true;
          break;

        case "End":
          newIndex = itemCount - 1;
          handled = true;
          break;

        case "Enter":
        case " ":
          if (onSelect) {
            onSelect(focusedIndex);
            handled = true;
          }
          break;
      }

      if (handled) {
        e.preventDefault();

        // Handle wrapping
        if (wrap) {
          if (newIndex < 0) newIndex = itemCount - 1;
          if (newIndex >= itemCount) newIndex = 0;
        } else {
          newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
        }

        if (newIndex !== focusedIndex) {
          setFocusedIndex(newIndex);
          onFocusChange?.(newIndex);
        }
      }
    },
    [focusedIndex, itemCount, pattern, wrap, columns, onSelect, onFocusChange]
  );

  const getItemProps = React.useCallback(
    (index: number) => ({
      tabIndex: index === focusedIndex ? 0 : -1,
      "aria-selected": index === focusedIndex,
      onFocus: () => setFocusedIndex(index),
    }),
    [focusedIndex]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getItemProps,
  };
}

interface KeyboardNavProps {
  /** Number of navigable items */
  itemCount: number;
  /** Navigation options */
  options?: KeyboardNavOptions;
  /** Render function receiving navigation state */
  children: (state: KeyboardNavState) => React.ReactNode;
  /** Container element type */
  as?: React.ElementType;
  /** Container role */
  role?: string;
  /** Additional container props */
  className?: string;
}

/**
 * Component wrapper for keyboard navigation.
 */
export function KeyboardNav({
  itemCount,
  options,
  children,
  as: Component = "div",
  role = "listbox",
  className,
}: KeyboardNavProps) {
  const state = useKeyboardNav(itemCount, options);

  return (
    <Component
      role={role}
      className={className}
      onKeyDown={state.handleKeyDown}
      aria-activedescendant={`item-${state.focusedIndex}`}
    >
      {children(state)}
    </Component>
  );
}
