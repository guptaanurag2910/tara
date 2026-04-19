import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[color:var(--tara-violet)] text-white",
        secondary:
          "border-transparent bg-[color:var(--tara-surface-elevated)] text-[color:var(--tara-text-primary)]",
        destructive: "border-transparent bg-rose-500 text-white",
        outline: "border-[color:var(--tara-card-border)] text-[color:var(--tara-text-primary)]",
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

