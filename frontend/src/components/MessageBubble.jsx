import { useState } from "react";
import { CornerUpLeft, EyeOff, Flag, SmilePlus } from "lucide-react";
import { GameQuestion, GameResult } from "./game";

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

function statusLabel(status, isRead) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "read" || isRead) {
    return "Read";
  }
  if (normalized === "delivered") {
    return "Delivered";
  }
  return "Sent";
}

export default function MessageBubble({
  message,
  isOwn,
  currentUserId = null,
  onGameAnswer,
  gameAnswers = [],
  currentUserAnswer = "",
  isAnsweringGameQuestion = false,
  onGameInviteResponse,
  isGameCompleted = false,
  isRespondingGameInvite = false,
  isWaitingForMatch = false,
  isYourTurn = false,
  onReply,
  onReaction,
  onReport,
  onHide,
  isHidden = false,
  onPrompt,
}) {
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const isGameEvent = String(message?.message_type || "text") === "game_event";
  const eventType = String(message?.game_payload?.event_type || "").trim().toLowerCase();
  const alignmentClass = isGameEvent ? "justify-center" : isOwn ? "justify-end" : "justify-start";

  if (isHidden) {
    return <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}><button className="rounded-full border border-dashed border-[#cfcfcf] px-3 py-2 text-xs text-[#737373]" onClick={() => onHide?.(message, false)} type="button">Message hidden · Show</button></div>;
  }

  if (isGameEvent && eventType === "game_night_memory") {
    const memory = message.game_payload || {};
    return (
      <div className="flex justify-center">
        <section className="chat-game-memory">
          <span className="chat-game-memory-eyebrow">Your first shared moment</span>
          <h2>{memory.game_name || "Game Night"}</h2>
          <p>{memory.detail || "You played together."}</p>
          {memory.prompt ? <button onClick={() => onPrompt?.(memory.prompt)} type="button">{memory.prompt} <span aria-hidden="true">↗</span></button> : null}
        </section>
      </div>
    );
  }

  if (isGameEvent && (eventType === "game_invite" || eventType === "game_started" || eventType === "game_start")) {
    const gamePayload = message?.game_payload || {};
    const gameName = gamePayload.game_name || ({
      guess_their_pick: "Guess Their Pick",
      build_a_story: "Build a Story",
      two_truths_and_a_lie: "Two Truths and a Lie",
      choose_your_adventure: "Choose Your Adventure",
      rank_these: "Rank These",
      would_you_rather: "Would You Rather?",
      caption_this: "Caption This",
      tic_tac_toe: "Tic Tac Toe",
      dots_and_boxes: "Dots and Boxes",
      snakes_ladders: "Snakes, Ladders & Secrets",
      bingo: "Bingo: Are We in Sync?",
      spot_the_difference: "Spot the Difference",
      memory_match: "Memory Match",
      pictionary: "Pictionary",
      word_search: "Word Search",
      unscramble: "Unscramble",
      emoji_decode: "Emoji Decode",
      cipher_breaker: "Cipher Breaker",
      photo_scavenger_hunt: "Photo Scavenger Hunt",
      word_association: "Word Association",
      secret_song_pick: "Secret Song Pick",
      collaborative_playlist: "Collaborative Playlist",
      mystery_playlist_mood: "Mystery Playlist Mood",
    }[gamePayload.category] || "This or That");
    const isStoryGame = gamePayload.category === "build_a_story";
    const isTruthLieGame = gamePayload.category === "two_truths_and_a_lie";
    const isAdventureGame = gamePayload.category === "choose_your_adventure";
    const isRankTheseGame = gamePayload.category === "rank_these";
    const isWouldYouRatherGame = gamePayload.category === "would_you_rather";
    const isCaptionGame = gamePayload.category === "caption_this";
    const isTicTacToeGame = gamePayload.category === "tic_tac_toe";
    const isDotsAndBoxesGame = gamePayload.category === "dots_and_boxes";
    const isPictionaryGame = gamePayload.category === "pictionary";
    const isWordSearchGame = gamePayload.category === "word_search";
    const isUnscrambleGame = gamePayload.category === "unscramble";
    const isSpotDifferenceGame = gamePayload.category === "spot_the_difference";
    const isMemoryMatchGame = gamePayload.category === "memory_match";
    const sessionId = Number(gamePayload.session_id);
    const inviteStatus = String(gamePayload.invite_status || (eventType === "game_started" ? "accepted" : "pending"));
    const canRespond = inviteStatus === "pending" && !isOwn;
    const canOpen = inviteStatus === "accepted" && !isGameCompleted && Array.isArray(gamePayload.questions);
    return (
      <div className={`flex ${alignmentClass}`}>
        <div className="w-full max-w-[92%] rounded-2xl border border-[#f3d6e0] bg-[#fff3f7] p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#d62964]">
            {inviteStatus === "pending" ? `${gameName} invite` : inviteStatus === "accepted" ? gameName : `${gameName} invite`}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#262626]">
            {inviteStatus === "pending"
              ? isOwn ? "Waiting for your match to join" : isSpotDifferenceGame ? "Can you both spot all the changes? Take turns searching." : isMemoryMatchGame ? "Flip two cards at a time. Match a pair to keep your turn." : gamePayload.category === "secret_song_pick" ? "Want to pick a song for this prompt and reveal together?" : isTicTacToeGame ? "Want a quick game? X goes first." : isDotsAndBoxesGame ? "Want to connect dots and claim boxes?" : isPictionaryGame ? "Want to draw something for each other?" : isWordSearchGame ? "Want to solve a word puzzle together?" : isUnscrambleGame ? "Want to unscramble ten words at your own pace?" : isCaptionGame ? "Want to write a caption for these scenes?" : isWouldYouRatherGame ? "Ready for a few fun dilemmas?" : isRankTheseGame ? "Want to compare your top picks?" : isAdventureGame ? "Ready for a little adventure?" : isTruthLieGame ? "Think you can spot their lie?" : isStoryGame ? "Want to build a silly story together?" : "Want to play five quick rounds?"
                : inviteStatus === "accepted"
                ? isGameCompleted ? "You finished the game together ✨" : isWaitingForMatch ? (isSpotDifferenceGame ? "Your scene is saved. Waiting for your match 🔍" : isMemoryMatchGame ? "Your board is saved. Waiting for your match 🃏" : isTicTacToeGame ? "Your move is saved. Waiting for your match ⭕" : isDotsAndBoxesGame ? "Your board is saved. Waiting for your match 🔲" : isPictionaryGame ? "Your drawing is saved. Waiting for your match ✏️" : isWordSearchGame ? "Your grid is saved. Waiting for your match 🔎" : isUnscrambleGame ? "Your words are saved. Waiting for your match 🔤" : isCaptionGame ? "Your captions are saved. Waiting for your match ✨" : isWouldYouRatherGame ? "Your choices are saved. Waiting for your match ✨" : isRankTheseGame ? "Your list is saved. Waiting for your match to finish ✨" : isAdventureGame ? "Your choices are saved. Waiting for your match to finish ✨" : isTruthLieGame ? "Your turn is saved. Waiting for your match ✨" : isStoryGame ? "Your lines are saved. Waiting for your match to finish the story ✨" : "All your picks are saved. Waiting for your match to finish ✨") : isYourTurn ? (isSpotDifferenceGame ? "Your turn · find a difference 🔍" : isMemoryMatchGame ? "Your turn · flip two cards 🃏" : isTicTacToeGame ? "It’s your turn on the board ⭕" : isDotsAndBoxesGame ? "It’s your turn on the board 🔲" : isPictionaryGame ? "Your match sent a drawing ✏️" : isWordSearchGame ? "Resume your word puzzle 🔎" : isUnscrambleGame ? "Your match is ready. Finish your words 🔤" : isCaptionGame ? "Your match captioned the scenes. Add yours to reveal ✨" : isWouldYouRatherGame ? "Your match is ready. Finish your choices to reveal ✨" : isRankTheseGame ? "Your match ranked the list. Add yours to compare ✨" : isAdventureGame ? "Your match is ready for an adventure ✨" : isTruthLieGame ? "Their statements are ready. Pick the lie ✨" : isStoryGame ? "Your match finished their lines. Add yours to reveal ✨" : "Your match finished their picks. Finish yours to reveal ✨") : isSpotDifferenceGame ? "Take turns spotting changes in an illustrated scene. Correct finds earn points; a miss passes the turn." : isMemoryMatchGame ? "A shared 4×4 board saves between turns. Find a pair to score and keep playing." : isTicTacToeGame ? "Take turns placing X and O. Three in a row wins; your board saves between turns." : isDotsAndBoxesGame ? "Connect dots to complete boxes. A completed box scores a point and earns another turn." : isPictionaryGame ? "Draw and find a secret prompt, then swap turns." : isWordSearchGame ? "Find the same ten words at your own pace, then compare grids." : isUnscrambleGame ? "Solve the same ten scrambled words privately, then compare your accuracy." : isCaptionGame ? "Write a funny caption for each scene. Your captions stay private until you both finish!" : isWouldYouRatherGame ? "Answer five dilemmas privately, then compare your choices!" : isRankTheseGame ? "Rank the list your way, then compare your order together!" : isAdventureGame ? "Make five choices and discover your ending together!" : isTruthLieGame ? "Write three statements, then guess their lie!" : isStoryGame ? "Add five story lines privately, then reveal together!" : "Pick all five privately, then reveal together!"
                : inviteStatus === "declined" ? "Game invite declined" : inviteStatus === "replaced" ? "This game was closed when a newer request was sent" : "Game invite expired"}
          </p>
          {canRespond ? (
            <div className="mt-3 flex justify-center gap-2">
              <button
                className="rounded-full bg-[#e1306c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                disabled={isRespondingGameInvite}
                onClick={() => onGameInviteResponse?.({ action: "accept", sessionId })}
                type="button"
              >
                {isRespondingGameInvite ? "Joining..." : "Play"}
              </button>
              <button
                className="rounded-full border border-[#dbdbdb] bg-white px-4 py-2 text-xs font-semibold text-[#555] disabled:opacity-60"
                disabled={isRespondingGameInvite}
                onClick={() => onGameInviteResponse?.({ action: "decline", sessionId })}
                type="button"
              >
                Not now
              </button>
            </div>
          ) : null}
          {canOpen ? (
            <button
              className="mt-3 rounded-full bg-[#e1306c] px-4 py-2 text-xs font-semibold text-white"
              onClick={() => onGameInviteResponse?.({ action: "open", sessionId, gamePayload })}
              type="button"
            >
                {isWaitingForMatch ? (isSpotDifferenceGame || isMemoryMatchGame || isTicTacToeGame || isDotsAndBoxesGame ? "View the board" : isPictionaryGame ? "View Pictionary" : isWordSearchGame ? "View your grid" : isUnscrambleGame ? "Check your words" : isCaptionGame ? "Check your captions" : isRankTheseGame ? "Check your ranking" : isAdventureGame ? "Resume your adventure" : isTruthLieGame ? "Check your game" : isStoryGame ? "Resume your story" : "Resume your picks") : isYourTurn ? (isSpotDifferenceGame || isMemoryMatchGame || isTicTacToeGame || isDotsAndBoxesGame ? "Make your move" : isPictionaryGame ? "Take your Pictionary turn" : isWordSearchGame ? "Continue Word Search" : isUnscrambleGame ? "Continue Unscramble" : isCaptionGame ? "Caption the scenes" : isRankTheseGame ? "Rank these items" : isAdventureGame ? "Finish your path" : isTruthLieGame ? "Guess the lie" : isStoryGame ? "Add your lines" : "Finish your picks") : `Play ${gameName}`}
            </button>
          ) : null}
          {message?.timestamp ? <p className="mt-2 text-[10px] text-[#737373]">{formatTime(message.timestamp)}</p> : null}
        </div>
      </div>
    );
  }

  if (isGameEvent && eventType === "game_question") {
    const questionId = Number(message?.game_payload?.question_id);
    const questionText = message?.game_payload?.question_text || message?.content || "Question";
    const options = Array.isArray(message?.game_payload?.options) ? message.game_payload.options : [];
    const hasAnswered = Boolean(String(currentUserAnswer || "").trim());

    return (
      <div className={`flex ${alignmentClass}`}>
        <div className="w-full max-w-[92%]">
          <GameQuestion
            question={questionText}
            options={options}
            disabled={isAnsweringGameQuestion || hasAnswered}
            selectedOption={currentUserAnswer}
            stepLabel={Number.isInteger(questionId) ? `Question #${questionId}` : ""}
            onAnswer={(option, optionIndex) =>
              onGameAnswer?.({
                message,
                option,
                optionIndex,
              })
            }
          />

          {Array.isArray(gameAnswers) && gameAnswers.length > 0 ? (
            <div className="mt-2 rounded-xl border border-[#e7e7e7] bg-[#fafafa] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">
                Answers
              </p>
              <div className="mt-1 space-y-1">
                {gameAnswers.map((answer) => {
                  const isOwnAnswer = Number(answer?.sender_id) === Number(currentUserId);
                  return (
                    <p
                      key={`${answer?.sender_id}-${answer?.content}`}
                      className={`text-xs ${isOwnAnswer ? "text-[#d62964]" : "text-[#0078c8]"}`}
                    >
                      <span className="font-semibold">{isOwnAnswer ? "You" : "Them"}:</span>{" "}
                      {answer?.content}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isGameEvent && eventType === "game_result") {
    return (
      <div className={`flex ${alignmentClass}`}>
        <div className="w-full max-w-[92%]">
          <GameResult
            compact
            resultText={message?.game_payload?.result_text || message?.content || "Result updated"}
          />
        </div>
      </div>
    );
  }

  if (isGameEvent && eventType === "game_round_result") {
    const answers = Array.isArray(message?.game_payload?.answers) ? message.game_payload.answers : [];
    return (
      <div className={`flex ${alignmentClass}`}>
        <section className="w-full max-w-[92%] rounded-2xl border border-[#eadcfb] bg-[#faf6ff] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8b54c6]">
            Round {message?.game_payload?.round_number || ""} reveal
          </p>
          <p className="mt-1 text-sm font-semibold text-[#262626]">
            {message?.game_payload?.question_text || "This or That"}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {answers.map((answer) => (
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#4a3b58]" key={answer.user_id}>
                {Number(answer.user_id) === Number(currentUserId) ? "You" : "Your match"}: {answer.answer}
              </span>
            ))}
          </div>
          <p className="mt-2 text-center text-xs font-semibold text-[#8b54c6]">
            {message?.game_payload?.result_text || message.content}
          </p>
        </section>
      </div>
    );
  }

  const bubbleClass = isGameEvent
    ? "rounded-[18px] border border-[#f3d6e0] bg-[#fff3f7] text-[#262626]"
    : isOwn
      ? "rounded-[18px] rounded-br-[5px] bg-[#3797f0] text-white"
      : "rounded-[18px] rounded-bl-[5px] bg-[#efefef] text-[#262626]";

  return (
    <div className={`flex ${alignmentClass}`}>
      <div className="chat-message-stack">
      <div className={`px-3.5 py-2.5 text-sm ${bubbleClass}`}>
        {isGameEvent ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#e1306c]">
            Game
          </p>
        ) : null}
        {message.reply_to ? (
          <div className={`chat-quoted-message ${isOwn ? "is-own" : ""}`}>
            <strong>{Number(message.reply_to.sender_id) === Number(currentUserId) ? "You" : "Your match"}</strong>
            <span>{message.reply_to.content}</span>
          </div>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={`mt-1 flex items-center gap-1 text-[10px] ${
            isGameEvent
              ? "text-[#737373]"
              : isOwn
                ? "text-white/80"
                : "text-[#737373]"
          }`}
        >
          <span>{formatTime(message.timestamp)}</span>
          {isOwn ? <span>• {statusLabel(message.status, message.is_read)}</span> : null}
        </div>
      </div>
      {!isGameEvent && message.id ? (
        <div className={`chat-message-actions ${isOwn ? "is-own" : ""}`}>
          <button aria-label="Reply to message" onClick={() => onReply?.(message)} type="button"><CornerUpLeft size={14} /></button>
          <button aria-expanded={reactionsOpen} aria-label="React to message" onClick={() => setReactionsOpen((open) => !open)} type="button"><SmilePlus size={14} /></button>
          <button aria-label="Hide message" onClick={() => onHide?.(message, true)} type="button"><EyeOff size={14} /></button>
          {!isOwn ? <button aria-label="Report message" onClick={() => onReport?.(message)} type="button"><Flag size={14} /></button> : null}
          {reactionsOpen ? <div className="chat-reaction-picker" role="group" aria-label="Choose a reaction">
            {["❤️", "😂", "✨", "👍", "😮"].map((emoji) => (
              <button aria-label={`React ${emoji}`} key={emoji} onClick={() => { onReaction?.(message, emoji); setReactionsOpen(false); }} type="button">{emoji}</button>
            ))}
          </div> : null}
        </div>
      ) : null}
      {isGameEvent && message?.game_payload?.session_id ? <div className="chat-message-actions"><button aria-label="Report game" onClick={() => onReport?.(message)} type="button"><Flag size={14} /></button><button aria-label="Hide game message" onClick={() => onHide?.(message, true)} type="button"><EyeOff size={14} /></button></div> : null}
      {!isGameEvent && Object.entries(message.reactions || {}).length > 0 ? (
        <div className={`chat-reaction-counts ${isOwn ? "is-own" : ""}`}>
          {Object.entries(message.reactions).filter(([, ids]) => Array.isArray(ids) && ids.length).map(([emoji, ids]) => (
            <button aria-label={`${emoji} reaction, ${ids.length}`} className={ids.includes(Number(currentUserId)) ? "is-mine" : ""} key={emoji} onClick={() => onReaction?.(message, emoji)} type="button">{emoji} {ids.length}</button>
          ))}
        </div>
      ) : null}
      </div>
    </div>
  );
}
