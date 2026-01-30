/**
 * Accessible Input Component
 * Extends Input with proper ARIA attributes, error states, and labels.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export interface AccessibleInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Error message to display */
  error?: string;
  /** Helper text below the input */
  helperText?: string;
  /** Label for the input (required for accessibility) */
  label?: string;
  /** Whether the label should be visually hidden */
  hideLabel?: boolean;
  /** ID for the input (auto-generated if not provided) */
  id?: string;
}

/**
 * Accessible input with error handling, labels, and ARIA attributes.
 */
const AccessibleInput = React.forwardRef<HTMLInputElement, AccessibleInputProps>(
  (
    {
      className,
      type,
      error,
      helperText,
      label,
      hideLabel = false,
      id: providedId,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    
    const describedByIds: string[] = [];
    if (error) describedByIds.push(errorId);
    if (helperText) describedByIds.push(helperId);
    if (ariaDescribedBy) describedByIds.push(ariaDescribedBy);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "block text-sm font-medium mb-1.5",
              hideLabel && "sr-only",
              error ? "text-destructive" : "text-foreground"
            )}
          >
            {label}
            {props.required && (
              <span className="text-destructive ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            id={id}
            className={cn(
              "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              error
                ? "border-destructive focus-visible:ring-destructive pr-10"
                : "border-input",
              className
            )}
            ref={ref}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={
              describedByIds.length > 0 ? describedByIds.join(" ") : undefined
            }
            {...props}
          />
          {error && (
            <AlertCircle
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive"
              aria-hidden="true"
            />
          )}
        </div>
        {error && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-destructive flex items-center gap-1"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
AccessibleInput.displayName = "AccessibleInput";

export { AccessibleInput };
