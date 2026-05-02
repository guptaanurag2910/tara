import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "tara-motion-pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tara-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--tara-primary-grad)] text-white shadow-glow hover:opacity-95",
        destructive:
          "border border-[color:var(--tara-color-destructive)]/35 bg-[color:var(--tara-color-destructive-soft)] text-[color:var(--tara-text-primary)] hover:opacity-95",
        outline:
          "border border-[color:var(--tara-card-border)] bg-[color:var(--tara-surface-soft)] text-[color:var(--tara-text-primary)] hover:border-[color:var(--tara-card-hover-border)]",
        secondary:
          "border border-[color:var(--tara-card-border)] bg-[color:var(--tara-surface-elevated)] text-[color:var(--tara-text-primary)] hover:border-[color:var(--tara-card-hover-border)]",
        ghost: "text-[color:var(--tara-text-primary)] hover:bg-[color:var(--tara-surface-soft)]",
        link: "text-[color:var(--tara-violet)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] px-4 py-2",
        sm: "min-h-[40px] rounded-md px-3 text-xs",
        lg: "min-h-[48px] rounded-md px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
