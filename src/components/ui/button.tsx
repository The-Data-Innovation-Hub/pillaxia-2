import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(138,116,249,0.4)] hover:shadow-[0_6px_20px_rgba(138,116,249,0.5)] hover:scale-[1.02] active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.4)] hover:scale-[1.02] active:scale-[0.98]",
        outline: "border border-white/30 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md hover:bg-white/70 dark:hover:bg-slate-800/70 hover:border-primary/30 shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        secondary: "bg-secondary/80 text-secondary-foreground backdrop-blur-md hover:bg-secondary shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        ghost: "hover:bg-white/50 dark:hover:bg-slate-800/50 hover:backdrop-blur-md",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
