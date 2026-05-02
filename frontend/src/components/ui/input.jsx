import * as React from "react";

import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-[44px] w-full rounded-md border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] px-3 py-2 text-base text-[color:var(--tara-text-primary)] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[color:var(--tara-text-faint)] focus-visible:border-[color:var(--tara-focus-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tara-focus-ring-soft)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
