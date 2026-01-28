import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/90 text-primary-foreground shadow-[0_2px_8px_rgba(138,116,249,0.3)]",
        secondary: "border-white/20 bg-secondary/80 text-secondary-foreground backdrop-blur-md",
        destructive: "border-destructive/20 bg-destructive/90 text-destructive-foreground shadow-[0_2px_8px_rgba(239,68,68,0.2)]",
        outline: "text-foreground border-white/30 dark:border-white/10 bg-white/40 dark:bg-slate-800/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
