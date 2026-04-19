export default function ProgressIndicator({ current, total, label = "Progress" }) {
  const safeTotal = total > 0 ? total : 1;
  const safeCurrent = Math.min(Math.max(current, 1), safeTotal);
  const percentage = (safeCurrent / safeTotal) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>
          {safeCurrent}/{safeTotal}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/15">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
