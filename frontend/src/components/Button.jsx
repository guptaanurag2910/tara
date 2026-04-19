export default function Button({
  children,
  type = "button",
  variant = "primary",
  fullWidth = true,
  loading = false,
  ...props
}) {
  const baseClass =
    "inline-flex items-center justify-center px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50";

  const variantClass =
    variant === "ghost"
      ? "tara-secondary-btn"
      : "tara-primary-btn";

  const widthClass = fullWidth ? "w-full" : "w-auto";

  return (
    <button className={`${baseClass} ${variantClass} ${widthClass}`} type={type} {...props}>
      {loading ? "Please wait..." : children}
    </button>
  );
}
