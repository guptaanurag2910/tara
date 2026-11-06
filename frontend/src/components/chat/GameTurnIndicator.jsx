export default function GameTurnIndicator({
  status,
  detail,
  isMyTurn = false,
  gameOver = false,
  testId = "game-turn-status",
  players = [],
}) {
  return (
    <section
      aria-live="polite"
      className={`rounded-2xl border-2 px-4 py-3 transition-colors ${
        gameOver
          ? "border-[#d8d8d8] bg-[#f7f7f7]"
          : isMyTurn
            ? "border-[#e1306c] bg-[#fff3f7]"
            : "border-[#dcecf8] bg-[#f1f8fd]"
      }`}
      data-testid={testId}
    >
      <p className={`text-base font-extrabold ${gameOver ? "text-[#262626]" : isMyTurn ? "text-[#c51e59]" : "text-[#176fa6]"}`}>
        {status}
      </p>
      {detail ? <p className="mt-0.5 text-xs font-medium text-[#5f5f5f]">{detail}</p> : null}
      {players.length ? (
        <div aria-label="Players and turns" className="mt-3 grid grid-cols-2 gap-2">
          {players.map((player, index) => (
            <div
              className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${
                player.active && !gameOver ? "border-[#e1306c] bg-[#fff8fa]" : "border-[#ededed] bg-white"
              }`}
              key={`${player.name}-${index}`}
            >
              {player.mark ? (
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black ${
                  player.mark === "X" ? "bg-[#fff0f5] text-[#e1306c]" : "bg-[#eef7ff] text-[#0095f6]"
                }`}>
                  {player.mark}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[#262626]">{player.name}</span>
                <span className={`block truncate text-[10px] font-semibold ${player.active && !gameOver ? "text-[#c51e59]" : "text-[#737373]"}`}>
                  {gameOver ? "Finished" : player.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
