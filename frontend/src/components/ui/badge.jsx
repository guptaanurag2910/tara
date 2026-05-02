import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "tara-chip tara-chip-accent border-[color:var(--tara-chip-border-accent)]",
        secondary: "tara-chip",
        destructive:
          "tara-chip border-[color:var(--tara-color-destructive)]/35 bg-[color:var(--tara-color-destructive-soft)] text-[color:var(--tara-text-primary)]",
        outline: "tara-chip bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
