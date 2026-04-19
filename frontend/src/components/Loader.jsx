export default function Loader({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-200">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-pink-400" />
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-orange-400 [animation-delay:150ms]" />
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300 [animation-delay:300ms]" />
      <span className="ml-2">{text}</span>
    </div>
  );
}
