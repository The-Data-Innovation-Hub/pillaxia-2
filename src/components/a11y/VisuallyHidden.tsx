import * as React from "react";
import { cn } from "@/lib/utils";

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

/**
 * Visually hides content while keeping it accessible to screen readers.
 * Use this for content that provides context to assistive technology users
 * but would be redundant or confusing visually.
 */
export function VisuallyHidden({ 
  children, 
  className,
  asChild = false,
  ...props 
}: VisuallyHiddenProps) {
  const Comp = asChild ? React.Fragment : "span";
  
  return (
    <Comp
      {...(!asChild && {
        className: cn("sr-only", className),
        ...props,
      })}
    >
      {children}
    </Comp>
  );
}
