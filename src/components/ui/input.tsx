import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl px-3 py-2 text-base ring-offset-background",
          "bg-white/50 dark:bg-slate-800/50",
          "backdrop-blur-md",
          "border border-white/30 dark:border-white/10",
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "focus-visible:bg-white/70 dark:focus-visible:bg-slate-800/70",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          "md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
