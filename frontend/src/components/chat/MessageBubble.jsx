function formatTime(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isOwn }) {
  const messageClass = isOwn
    ? "rounded-3xl rounded-br-xl bg-gradient-to-r from-[#675bff] via-[#7c77ff] to-[#d8b86a] text-white"
    : "rounded-3xl rounded-bl-xl border border-[#2b2f7c]/70 bg-[#10134f]/55 text-white/95";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div
        className={`max-w-[84%] px-4 py-3 shadow-[0_8px_28px_rgba(3,4,24,0.35)] transition-colors sm:max-w-[70%] ${messageClass}`}
      >
        <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-6">{message?.content || ""}</p>
        <p className={`mt-1 text-[10px] ${isOwn ? "text-white/85" : "text-white/60"}`}>
          {formatTime(message?.timestamp || message?.created_at)}
        </p>
      </div>
    </div>
  );
}
