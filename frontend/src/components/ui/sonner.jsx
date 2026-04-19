import { Toaster as Sonner } from "sonner";

const Toaster = (props) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[color:var(--tara-card-bg)] group-[.toaster]:text-[color:var(--tara-text-primary)] group-[.toaster]:border-[color:var(--tara-card-border)] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[color:var(--tara-text-secondary)]",
          actionButton: "group-[.toast]:bg-[var(--tara-primary-grad)] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-[color:var(--tara-text-secondary)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

