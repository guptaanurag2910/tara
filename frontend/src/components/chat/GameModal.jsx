import { useEffect, useMemo, useState } from "react";
import PictionaryGame from "./PictionaryGame";
import WordSearchGame from "./WordSearchGame";
import DotsAndBoxesGame from "./DotsAndBoxesGame";
import UnscrambleGame from "./UnscrambleGame";
import GameTurnIndicator from "./GameTurnIndicator";
import WordAssociationGame from "./WordAssociationGame";
import SecretSongPickGame from "./SecretSongPickGame";
import CollaborativePlaylistGame from "./CollaborativePlaylistGame";
import MysteryPlaylistMoodGame from "./MysteryPlaylistMoodGame";
import SnakesLaddersGame from "./SnakesLaddersGame";
import BingoGame from "./BingoGame";
import SpotTheDifferenceGame from "./SpotTheDifferenceGame";
import MemoryMatchGame from "./MemoryMatchGame";

function normalizeOption(option, index) {
  if (typeof option === "string") {
    return { id: null, text: option, raw: option, key: `${option}-${index}` };
  }
  if (option && typeof option === "object") {
    const text = String(option.text || option.label || option.value || `Option ${index + 1}`);
    const optionId = option.id ?? null;
    return { id: optionId, text, raw: option, key: `${text}-${index}` };
  }
  return { id: null, text: `Option ${index + 1}`, raw: option, key: `option-${index}` };
}

export default function GameModal({
  open,
  questions = [],
  category = "",
  sessionId = null,
  onClose,
  onAnswer,
  onPhotoScavengerUpload,
  wordAssociationState = null,
  onWordAssociationSubmit,
  onWaiting,
  socketError = "",
  waitingForMatch = false,
  yourTurn = false,
  answeredQuestionIds = [],
  statementSets = null,
  guessedQuestionIds = [],
  currentUserId = null,
  partnerName = "Your match",
  ticTacToeState = null,
  onTicTacToeMove,
  dotsBoxesState = null,
  onDotsBoxesMove,
  pictionaryState = null,
  onPictionaryAction,
  wordSearchState = null,
  onWordSearchSelect,
  unscrambleState = null,
  unscrambleFeedback = null,
  onUnscrambleSubmit,
  collaborativePlaylistState = null,
  onCollaborativePlaylistSubmit,
  mysteryPlaylistMoodState = null,
  onMysteryPlaylistMoodSubmit,
  snakesLaddersState = null,
  onSnakesLaddersAction,
  bingoState = null,
  onBingoAction,
  spotDifferenceState = null,
  onSpotDifferenceAction,
  memoryMatchState = null,
  onMemoryMatchAction,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [localAnsweredQuestionIds, setLocalAnsweredQuestionIds] = useState([]);
  const [guessStep, setGuessStep] = useState("pick");
  const [draftPicks, setDraftPicks] = useState({});
  const [storyLine, setStoryLine] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [truthStatements, setTruthStatements] = useState(["", "", ""]);
  const [lieIndex, setLieIndex] = useState(null);
  const [localGuessedQuestionIds, setLocalGuessedQuestionIds] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [emojiGuess, setEmojiGuess] = useState("");
  const [scavengerPhoto, setScavengerPhoto] = useState(null);
  const [scavengerCaption, setScavengerCaption] = useState("");
  const [scavengerPreview, setScavengerPreview] = useState("");
  const isGuessGame = String(category || "").toLowerCase() === "guess_their_pick";
  const isStoryGame = String(category || "").toLowerCase() === "build_a_story";
  const isCaptionGame = String(category || "").toLowerCase() === "caption_this";
  const isTruthLieGame = String(category || "").toLowerCase() === "two_truths_and_a_lie";
  const isAdventureGame = String(category || "").toLowerCase() === "choose_your_adventure";
  const isRankTheseGame = String(category || "").toLowerCase() === "rank_these";
  const isTicTacToeGame = String(category || "").toLowerCase() === "tic_tac_toe";
  const isDotsAndBoxesGame = String(category || "").toLowerCase() === "dots_and_boxes";
  const isPictionaryGame = String(category || "").toLowerCase() === "pictionary";
  const isWordSearchGame = String(category || "").toLowerCase() === "word_search";
  const isUnscrambleGame = String(category || "").toLowerCase() === "unscramble";
  const isEmojiDecodeGame = String(category || "").toLowerCase() === "emoji_decode";
  const isCipherBreakerGame = String(category || "").toLowerCase() === "cipher_breaker";
  const isPhotoScavengerGame = String(category || "").toLowerCase() === "photo_scavenger_hunt";
  const isWordAssociationGame = String(category || "").toLowerCase() === "word_association";
  const isSecretSongPickGame = String(category || "").toLowerCase() === "secret_song_pick";
  const isCollaborativePlaylistGame = String(category || "").toLowerCase() === "collaborative_playlist";
  const isMysteryPlaylistMoodGame = String(category || "").toLowerCase() === "mystery_playlist_mood";
  const isSnakesLaddersGame = String(category || "").toLowerCase() === "snakes_ladders";
  const isBingoGame = String(category || "").toLowerCase() === "bingo";
  const isSpotDifferenceGame = String(category || "").toLowerCase() === "spot_the_difference";
  const isMemoryMatchGame = String(category || "").toLowerCase() === "memory_match";
  const answeredIdsKey = answeredQuestionIds.map(Number).sort((a, b) => a - b).join(",");
  const effectiveAnsweredIds = useMemo(
    () => new Set([...answeredQuestionIds, ...localAnsweredQuestionIds].map(Number)),
    [answeredIdsKey, localAnsweredQuestionIds],
  );
  const unansweredIndex = questions.findIndex((question) =>
    !effectiveAnsweredIds.has(Number(question.id)),
  );
  const effectiveGuessedIds = new Set([...guessedQuestionIds, ...localGuessedQuestionIds].map(Number));
  const allAnswered = questions.length > 0 && (isTruthLieGame
    ? effectiveGuessedIds.has(Number(questions[0]?.id))
    : unansweredIndex < 0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSubmitting(false);
    setLocalAnsweredQuestionIds([]);
    setGuessStep("pick");
    setDraftPicks({});
    setStoryLine("");
    setCaptionText("");
    setTruthStatements(["", "", ""]);
    setLieIndex(null);
    setLocalGuessedQuestionIds([]);
    setRanking([]);
    setEmojiGuess("");
    setScavengerPhoto(null);
    setScavengerCaption("");
    setError("");
  }, [open, sessionId]);

  useEffect(() => {
    if (!scavengerPhoto) {
      setScavengerPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(scavengerPhoto);
    setScavengerPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [scavengerPhoto]);

  useEffect(() => {
    setWaiting(Boolean(waitingForMatch));
  }, [waitingForMatch]);

  useEffect(() => {
    setSubmitting(false);
  }, [ticTacToeState]);

  const currentQuestion = isTruthLieGame
    ? questions[0] || null
    : unansweredIndex >= 0 ? questions[unansweredIndex] : null;
  const truthLieSubmitted = Boolean(currentQuestion && effectiveAnsweredIds.has(Number(currentQuestion.id)));
  const truthLieGuessed = Boolean(currentQuestion && effectiveGuessedIds.has(Number(currentQuestion.id)));
  const partnerStatements = currentQuestion && statementSets
    ? Object.entries(statementSets).find(([userId]) => Number(userId) !== Number(currentUserId))?.[1]
    : null;
  const options = (Array.isArray(currentQuestion?.options) ? currentQuestion.options : []).map(
    normalizeOption,
  );
  useEffect(() => {
    if (isRankTheseGame && currentQuestion) {
      setRanking((previous) => previous.length ? previous : options.map((option) => option.key));
    }
  }, [isRankTheseGame, currentQuestion?.id]);
  const progress = useMemo(() => {
    const total = questions.length || 1;
    return Math.min(100, Math.round((effectiveAnsweredIds.size / total) * 100));
  }, [effectiveAnsweredIds, questions.length]);

  useEffect(() => {
    if (socketError) {
      setWaiting(false);
      setSubmitting(false);
      setLocalAnsweredQuestionIds([]);
      setError(socketError);
      onWaiting?.(null);
    }
  }, [socketError, onWaiting]);

  if (!open) {
    return null;
  }

  if (isWordAssociationGame) {
    return <WordAssociationGame state={wordAssociationState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onSubmit={onWordAssociationSubmit} socketError={socketError} onClose={onClose} />;
  }

  if (isSecretSongPickGame) {
    return <SecretSongPickGame question={questions[0]?.question_text} sessionId={sessionId} questionId={questions[0]?.id} answered={answeredQuestionIds.map(Number).includes(Number(questions[0]?.id))} waitingForMatch={waitingForMatch} onAnswer={onAnswer} socketError={socketError} onClose={onClose} />;
  }

  if (isCollaborativePlaylistGame) {
    return <CollaborativePlaylistGame state={collaborativePlaylistState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onSubmit={onCollaborativePlaylistSubmit} socketError={socketError} onClose={onClose} />;
  }

  if (isMysteryPlaylistMoodGame) {
    return <MysteryPlaylistMoodGame state={mysteryPlaylistMoodState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onSubmit={onMysteryPlaylistMoodSubmit} socketError={socketError} onClose={onClose} />;
  }

  if (isSnakesLaddersGame) {
    return <SnakesLaddersGame state={snakesLaddersState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onAction={onSnakesLaddersAction} onClose={onClose} socketError={socketError} />;
  }

  if (isBingoGame) {
    return <BingoGame state={bingoState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onAction={onBingoAction} onClose={onClose} socketError={socketError} />;
  }

  if (isSpotDifferenceGame) {
    return <SpotTheDifferenceGame state={spotDifferenceState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onAction={onSpotDifferenceAction} onClose={onClose} socketError={socketError} />;
  }

  if (isMemoryMatchGame) {
    return <MemoryMatchGame state={memoryMatchState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onAction={onMemoryMatchAction} onClose={onClose} socketError={socketError} />;
  }

  if (isPictionaryGame) {
    return <PictionaryGame state={pictionaryState} sessionId={sessionId} partnerName={partnerName} onAction={onPictionaryAction} onClose={onClose} socketError={socketError} />;
  }
  if (isWordSearchGame) {
    return <WordSearchGame state={wordSearchState} sessionId={sessionId} onSelect={onWordSearchSelect} onClose={onClose} socketError={socketError} />;
  }
  if (isDotsAndBoxesGame) {
    return <DotsAndBoxesGame state={dotsBoxesState} sessionId={sessionId} currentUserId={currentUserId} partnerName={partnerName} onMove={onDotsBoxesMove} onClose={onClose} socketError={socketError} />;
  }


  if (isUnscrambleGame) {
    return <UnscrambleGame state={unscrambleState} feedback={unscrambleFeedback} sessionId={sessionId} onSubmit={onUnscrambleSubmit} onClose={onClose} socketError={socketError} />;
  }

  async function handleOptionClick(option) {
    if (!currentQuestion || !onAnswer || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    if (isGuessGame && guessStep === "pick") {
      setDraftPicks((previous) => ({
        ...previous,
        [currentQuestion.id]: { ...previous[currentQuestion.id], pick: option.text },
      }));
      setGuessStep("guess");
      setSubmitting(false);
      return;
    }

    const payload = {
      session_id: sessionId,
      question_id: currentQuestion.id,
      selected_option: option.text,
      text_answer: option.text,
    };
    if (isGuessGame) {
      const pick = draftPicks[currentQuestion.id]?.pick;
      if (!pick) {
        setError("Choose your own pick first.");
        setSubmitting(false);
        return;
      }
      payload.text_answer = pick;
      payload.selected_option = pick;
      payload.predicted_text_answer = option.text;
    }
    if (Number.isInteger(option.id)) {
      payload.selected_option_id = option.id;
    }

    try {
      await onAnswer(payload);
      const updatedAnsweredIds = new Set(effectiveAnsweredIds);
      updatedAnsweredIds.add(Number(currentQuestion.id));
      setLocalAnsweredQuestionIds([...updatedAnsweredIds]);
      setGuessStep("pick");
      setDraftPicks((previous) => {
        const next = { ...previous };
        delete next[currentQuestion.id];
        return next;
      });
      const hasUnansweredQuestion = questions.some((question) => !updatedAnsweredIds.has(Number(question.id)));
      if (!hasUnansweredQuestion) {
        setWaiting(true);
        onWaiting?.(Number(sessionId));
      }
    } catch (submitError) {
      setError(submitError?.message || "Could not submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStorySubmit() {
    const line = storyLine.trim();
    if (!currentQuestion || !onAnswer || submitting || !line) return;
    setSubmitting(true);
    setError("");
    try {
      await onAnswer({ session_id: sessionId, question_id: currentQuestion.id, story_text: line });
      const updatedAnsweredIds = new Set(effectiveAnsweredIds);
      updatedAnsweredIds.add(Number(currentQuestion.id));
      setLocalAnsweredQuestionIds([...updatedAnsweredIds]);
      setStoryLine("");
      if (!questions.some((question) => !updatedAnsweredIds.has(Number(question.id)))) {
        setWaiting(true);
        onWaiting?.(Number(sessionId));
      }
    } catch (submitError) {
      setError(submitError?.message || "Could not save your story line. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCaptionSubmit() {
    const caption = captionText.trim();
    if (!currentQuestion || !onAnswer || submitting || !caption) return;
    setSubmitting(true);
    setError("");
    try {
      await onAnswer({ session_id: sessionId, question_id: currentQuestion.id, caption_text: caption });
      const updatedAnsweredIds = new Set(effectiveAnsweredIds);
      updatedAnsweredIds.add(Number(currentQuestion.id));
      setLocalAnsweredQuestionIds([...updatedAnsweredIds]);
      setCaptionText("");
      if (!questions.some((question) => !updatedAnsweredIds.has(Number(question.id)))) {
        setWaiting(true);
        onWaiting?.(Number(sessionId));
      }
    } catch (submitError) {
      setError(submitError?.message || "Could not save your caption. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmojiDecodeSubmit() {
    const guess = emojiGuess.trim();
    if (!currentQuestion || !onAnswer || submitting || !guess) return;
    setSubmitting(true);
    setError("");
    try {
      await onAnswer({ session_id: sessionId, question_id: currentQuestion.id, text_answer: guess });
      const updatedAnsweredIds = new Set(effectiveAnsweredIds);
      updatedAnsweredIds.add(Number(currentQuestion.id));
      setLocalAnsweredQuestionIds([...updatedAnsweredIds]);
      setEmojiGuess("");
      if (!questions.some((question) => !updatedAnsweredIds.has(Number(question.id)))) {
        setWaiting(true);
        onWaiting?.(Number(sessionId));
      }
    } catch (submitError) {
      setError(submitError?.message || "Could not save your guess. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScavengerSubmit() {
    if (!currentQuestion || !scavengerPhoto || !onPhotoScavengerUpload || !onAnswer || submitting) return;
    if (scavengerPhoto.size > 8 * 1024 * 1024) {
      setError("Choose an image smaller than 8 MB.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onPhotoScavengerUpload({
        session_id: sessionId,
        question_id: currentQuestion.id,
        image: scavengerPhoto,
        caption: scavengerCaption.trim(),
      });
      await onAnswer({
        session_id: sessionId,
        question_id: currentQuestion.id,
        text_answer: "__photo_scavenger_submission__",
      });
      setLocalAnsweredQuestionIds([Number(currentQuestion.id)]);
      setScavengerPhoto(null);
      setScavengerCaption("");
      setWaiting(true);
      onWaiting?.(Number(sessionId));
    } catch (submitError) {
      setError(submitError?.message || "Could not share your photo. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTicTacToeMove(cellIndex) {
    if (!onTicTacToeMove || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const sent = await onTicTacToeMove({ session_id: sessionId, cell_index: cellIndex });
      if (sent === false) throw new Error("Reconnect to make your move.");
    } catch (submitError) {
      setSubmitting(false);
      setError(submitError?.message || "Could not save your move. Please try again.");
    }
  }

  async function handleTruthLieSubmit() {
    if (!currentQuestion || !onAnswer || submitting) return;
    const statements = truthStatements.map((value) => value.trim());
    if (statements.some((value) => !value)) {
      setError("Fill in all three statements.");
      return;
    }
    if (lieIndex === null) {
      setError("Mark one statement as the lie.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onAnswer({ session_id: sessionId, question_id: currentQuestion.id, truth_statements: statements, lie_index: lieIndex });
      setLocalAnsweredQuestionIds((previous) => [...new Set([...previous, Number(currentQuestion.id)])]);
      setWaiting(true);
      onWaiting?.(Number(sessionId));
    } catch (submitError) {
      setError(submitError?.message || "Could not save your statements. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTruthLieGuess(index) {
    if (!currentQuestion || !onAnswer || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onAnswer({ session_id: sessionId, question_id: currentQuestion.id, guessed_lie_index: index });
      setLocalGuessedQuestionIds((previous) => [...new Set([...previous, Number(currentQuestion.id)])]);
      setWaiting(true);
      onWaiting?.(Number(sessionId));
    } catch (submitError) {
      setError(submitError?.message || "Could not save your guess. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRankSubmit() {
    if (!currentQuestion || !onAnswer || submitting) return;
    setSubmitting(true);
    setError("");
    const orderedOptions = ranking.map((key) => options.find((option) => option.key === key)).filter(Boolean);
    try {
      await onAnswer({ session_id: sessionId, question_id: currentQuestion.id, ranking: orderedOptions.map((option) => option.raw.id) });
      setLocalAnsweredQuestionIds((previous) => [...new Set([...previous, Number(currentQuestion.id)])]);
      setWaiting(true);
      onWaiting?.(Number(sessionId));
    } catch (submitError) {
      setError(submitError?.message || "Could not save your ranking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function moveRankedItem(index, direction) {
    setRanking((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[20px] border border-[#e7e7e7] bg-white p-5 font-[DM_Sans] shadow-[0_20px_60px_rgba(0,0,0,0.22)] animate-scale-in"
        data-testid="game-modal"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[#e1306c]">
              {isCaptionGame ? "Caption This" : isTicTacToeGame ? "Tic Tac Toe" : isPhotoScavengerGame ? "Photo Scavenger Hunt" : String(category || "game").replace(/_/g, " ")}
            </p>
          <p className="mt-1 text-sm text-[#737373]">{isCipherBreakerGame ? "Decode five secret messages. Use a hint if you get stuck; your answers reveal together." : isPhotoScavengerGame ? "Find one photo for the prompt. Each photo stays private until both of you share." : isTicTacToeGame ? "Take turns on one shared board. Your game saves between visits." : isCaptionGame ? "Write a caption for each scene. Your captions reveal together." : isRankTheseGame ? "Put the list in your personal order. You’ll compare rankings after you both submit." : isAdventureGame ? "Five choices shape your path. Your endings reveal together." : isTruthLieGame ? "Share three statements, then guess their lie." : isGuessGame ? "Pick, predict, then reveal together." : isStoryGame ? "Add a line for each prompt. Your lines reveal together." : "Pick privately. All answers reveal after you both finish."}</p>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-[#dbdbdb] text-lg text-[#737373] transition-colors hover:text-[#262626]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {!isTicTacToeGame ? <div className="mt-4 h-[3px] w-full rounded-full bg-[#efefef]">
            <div
              className="h-[3px] rounded-full bg-gradient-to-r from-[#f77737] via-[#e1306c] to-[#0095f6] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
        </div> : null}

        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[#737373]">
            {isPhotoScavengerGame ? "Your photo" : isTruthLieGame ? (truthLieSubmitted ? "Your set is in" : "Your set") : isCaptionGame ? "Your captions" : isRankTheseGame ? "Your ranking" : isStoryGame ? "Your lines" : isAdventureGame ? "Your choices" : "Your picks"} {!isTruthLieGame ? `${Math.min(effectiveAnsweredIds.size, questions.length)} of ${questions.length || 1}` : ""}
          </p>
          {!allAnswered ? (
            <>
              {isTruthLieGame ? (
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#e1306c]">{truthLieSubmitted ? partnerStatements ? "Guess their lie" : "Waiting for their statements" : "Your three statements"}</p>
              ) : isStoryGame ? (
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#e1306c]">Your story turn</p>
              ) : isGuessGame ? (
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#e1306c]">
                  {guessStep === "pick" ? "Your pick" : "Guess their pick"}
                </p>
              ) : null}
              {(!isTruthLieGame || !truthLieSubmitted) && !isCaptionGame && !isTicTacToeGame ? <p className={`mt-3 font-bold leading-tight text-[#262626] ${isEmojiDecodeGame ? "text-center text-5xl sm:text-6xl" : isCipherBreakerGame ? "text-center font-mono text-xl tracking-[0.12em] sm:text-2xl" : "text-[1.6rem] sm:text-[1.9rem]"}`}>
                {currentQuestion?.question_text || "Question"}
              </p> : null}
              {isGuessGame && guessStep === "guess" ? (
                <p className="mt-2 text-sm text-[#737373]">What do you think your match will pick? Your answer: <span className="font-semibold text-[#262626]">{draftPicks[currentQuestion?.id]?.pick}</span></p>
              ) : null}
            </>
          ) : null}

          {yourTurn && !waiting && !allAnswered && !isTicTacToeGame ? (
            <p className="mt-3 rounded-xl bg-[#f0f8ff] px-3 py-2 text-center text-sm font-medium text-[#286b9b]">
              {isPhotoScavengerGame ? "Your match shared a photo. Share yours to reveal both together ✨" : "Your match finished their picks. Finish yours to reveal everything ✨"}
            </p>
          ) : null}

          {!allAnswered && isTruthLieGame && currentQuestion ? (
            !truthLieSubmitted ? (
              <div className="mt-5 space-y-3">
                {truthStatements.map((statement, index) => (
                  <div className={`rounded-[14px] border p-3 ${lieIndex === index ? "border-[#e1306c] bg-[#fff3f7]" : "border-[#dbdbdb] bg-[#fafafa]"}`} key={index}>
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[#737373]">{index + 1}</span>
                      <input className="min-w-0 flex-1 bg-transparent py-1 text-sm text-[#262626] outline-none placeholder:text-[#a3a3a3]" maxLength={160} onChange={(event) => setTruthStatements((previous) => previous.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder={`Statement ${index + 1}`} value={statement} />
                    </div>
                    <button className={`ml-9 mt-2 rounded-full px-3 py-1 text-xs font-semibold ${lieIndex === index ? "bg-[#e1306c] text-white" : "bg-white text-[#737373]"}`} onClick={() => setLieIndex(index)} type="button">{lieIndex === index ? "This is my lie ✓" : "Mark as my lie"}</button>
                  </div>
                ))}
                <p className="text-center text-xs text-[#737373]">Keep it fun and kind. Your match won't see which one you marked.</p>
                <button className="w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={submitting || truthStatements.some((value) => !value.trim()) || lieIndex === null} onClick={handleTruthLieSubmit} type="button">{submitting ? "Saving…" : "Lock in my statements"}</button>
              </div>
            ) : partnerStatements ? (
              <div className="mt-5 space-y-3">
                {partnerStatements.map((statement, index) => (
                  <button className="flex w-full items-start gap-3 rounded-[14px] border border-[#dbdbdb] bg-[#fafafa] p-4 text-left transition hover:border-[#e1306c] disabled:opacity-60" disabled={submitting || truthLieGuessed} key={index} onClick={() => handleTruthLieGuess(index)} type="button">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[#737373]">{index + 1}</span><span className="text-sm leading-relaxed text-[#262626]">{statement}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#fff3f7] px-4 py-5 text-center"><p className="text-sm font-semibold text-[#a52b55]">Your statements are locked in ✨</p><p className="mt-1 text-sm text-[#7d5261]">Once your match adds theirs, you can guess which one is the lie.</p><button className="mt-4 rounded-full border border-[#e8bdcc] bg-white px-4 py-2 text-sm font-semibold text-[#a52b55]" onClick={onClose} type="button">Back to chat</button></div>
            )
          ) : null}

          {!allAnswered && isStoryGame && currentQuestion ? (
            <div className="mt-5 space-y-3">
              <textarea
                className="min-h-28 w-full resize-none rounded-[14px] border border-[#dbdbdb] bg-[#fafafa] p-4 text-base text-[#262626] outline-none transition focus:border-[#e1306c]"
                maxLength={240}
                onChange={(event) => setStoryLine(event.target.value)}
                placeholder="Add the next line to your story…"
                value={storyLine}
              />
              <div className="flex items-center justify-between text-xs text-[#737373]"><span>Keep it kind and playful</span><span>{storyLine.length}/240</span></div>
              <button className="w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!storyLine.trim() || submitting || waiting} onClick={handleStorySubmit} type="button">{submitting ? "Saving…" : "Add my line"}</button>
            </div>
          ) : null}

          {!allAnswered && isCaptionGame && currentQuestion ? (
            <div className="mt-5 space-y-3">
              <div className="overflow-hidden rounded-[18px] border border-[#f1d7e1] bg-gradient-to-br from-[#fff7fa] via-[#fff] to-[#f4f8ff] p-5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e1306c]">Caption this scene</p>
                <span aria-hidden="true" className="my-3 block text-6xl">{currentQuestion?.options?.[0]?.emoji || "🎨"}</span>
                <p className="text-sm font-medium leading-relaxed text-[#333]">{currentQuestion?.question_text}</p>
              </div>
              <textarea className="min-h-24 w-full resize-none rounded-[14px] border border-[#dbdbdb] bg-[#fafafa] p-4 text-base text-[#262626] outline-none transition focus:border-[#e1306c]" maxLength={200} onChange={(event) => setCaptionText(event.target.value)} placeholder="Write your caption…" value={captionText} />
              <div className="flex items-center justify-between text-xs text-[#737373]"><span>Keep it playful</span><span>{captionText.length}/200</span></div>
              <button className="w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!captionText.trim() || submitting} onClick={handleCaptionSubmit} type="button">{submitting ? "Saving…" : "Lock in caption"}</button>
            </div>
          ) : null}

          {!allAnswered && (isEmojiDecodeGame || isCipherBreakerGame) && currentQuestion && !waiting ? (
            <div className="mt-5 space-y-3">
              {isCipherBreakerGame ? <div className="rounded-xl bg-[#fff8fb] p-3 text-center"><p className="text-xs font-bold uppercase tracking-wide text-[#a52b55]">Caesar cipher · shift 3</p><p className="mt-1 text-sm text-[#737373]">Move each encrypted letter back three places.</p>{currentQuestion?.options?.[0]?.hint ? <details className="mt-2 text-sm text-[#555]"><summary className="cursor-pointer font-semibold text-[#a52b55]">Need a hint?</summary><p className="mt-2">{currentQuestion.options[0].hint}</p></details> : null}</div> : <p className="text-center text-sm text-[#737373]">What phrase or saying do these emojis represent?</p>}
              <input aria-label={isCipherBreakerGame ? "Your cipher solution" : "Your emoji clue guess"} className="w-full rounded-[14px] border border-[#dbdbdb] bg-[#fafafa] px-4 py-3 text-center text-base text-[#262626] outline-none focus:border-[#e1306c]" maxLength={100} onChange={(event) => setEmojiGuess(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleEmojiDecodeSubmit(); }} placeholder={isCipherBreakerGame ? "Type the decoded message…" : "Type your guess…"} value={emojiGuess} />
              <p className="text-center text-xs text-[#737373]">One guess per clue. Both guesses reveal together.</p>
              <button className="w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!emojiGuess.trim() || submitting} onClick={handleEmojiDecodeSubmit} type="button">{submitting ? "Saving…" : "Lock in answer"}</button>
            </div>
          ) : null}

          {!allAnswered && isPhotoScavengerGame && currentQuestion && !waiting ? (
            <div className="mt-5 space-y-3">
              <label className="block cursor-pointer rounded-[16px] border-2 border-dashed border-[#e7bdd0] bg-[#fff8fb] p-4 text-center transition hover:border-[#e1306c]">
                {scavengerPreview ? <img alt="Photo you selected for the hunt" className="mx-auto max-h-64 w-full rounded-xl object-cover" src={scavengerPreview} /> : <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-3xl">📸</span>}
                <span className="mt-2 block text-sm font-semibold text-[#a52b55]">{scavengerPhoto ? "Choose a different photo" : "Take or choose a photo"}</span>
                <input accept="image/*" aria-label="Choose a scavenger hunt photo" className="sr-only" onChange={(event) => setScavengerPhoto(event.target.files?.[0] || null)} type="file" />
              </label>
              <textarea aria-label="Photo caption (optional)" className="min-h-20 w-full resize-none rounded-[14px] border border-[#dbdbdb] bg-[#fafafa] p-3 text-sm text-[#262626] outline-none focus:border-[#e1306c]" maxLength={280} onChange={(event) => setScavengerCaption(event.target.value)} placeholder="Add a little story (optional)…" value={scavengerCaption} />
              <p className="text-center text-xs text-[#737373]">Only your match can see this after you both share. Images up to 8 MB.</p>
              <button className="w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!scavengerPhoto || submitting} onClick={handleScavengerSubmit} type="button">{submitting ? "Sharing…" : "Lock in my photo"}</button>
            </div>
          ) : null}

          {isTicTacToeGame && ticTacToeState ? (() => {
            const board = Array.isArray(ticTacToeState.board) ? ticTacToeState.board : Array(9).fill(null);
            const marks = ticTacToeState.marks || {};
            const myMark = marks[String(currentUserId)] || "X";
            const isMyTurn = Number(ticTacToeState.turn_user_id) === Number(currentUserId);
            const gameOver = Boolean(ticTacToeState.winner_user_id || ticTacToeState.draw);
            const winningCells = new Set(ticTacToeState.winning_line || []);
            const partnerMark = myMark === "X" ? "O" : "X";
            const statusLabel = gameOver
              ? ticTacToeState.draw
                ? "Game over · Draw"
                : Number(ticTacToeState.winner_user_id) === Number(currentUserId)
                  ? "You won!"
                  : `${partnerName} won`
              : isMyTurn ? "Your turn" : `${partnerName}’s turn`;
            return <div className="mt-5">
              <div className="mb-4">
                <GameTurnIndicator
                  status={statusLabel}
                  detail={gameOver ? "The final board is saved in chat." : isMyTurn ? `Tap a square to place ${myMark}.` : `${partnerName} is choosing a square.`}
                  isMyTurn={isMyTurn}
                  gameOver={gameOver}
                  testId="tic-tac-toe-turn-status"
                  players={[
                    { name: "You", mark: myMark, active: isMyTurn, status: isMyTurn ? "Playing now" : "Up next" },
                    { name: partnerName, mark: partnerMark, active: !isMyTurn, status: !isMyTurn ? "Playing now" : "Up next" },
                  ]}
                />
              </div>
              <div aria-label="Tic Tac Toe board" className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-2" role="grid">
                {board.map((mark, index) => <button aria-label={`Cell ${index + 1}${mark ? `, ${mark}` : ", empty"}`} className={`grid aspect-square place-items-center rounded-2xl border text-5xl font-bold transition ${winningCells.has(index) ? "border-[#f7b731] bg-[#fff8e7]" : "border-[#e7e7e7] bg-[#fafafa]"} ${mark === "X" ? "text-[#e1306c]" : mark === "O" ? "text-[#0095f6]" : "text-transparent"} disabled:cursor-default`} disabled={!isMyTurn || Boolean(mark) || gameOver || submitting} key={index} onClick={() => handleTicTacToeMove(index)} role="gridcell" type="button">{mark || "·"}</button>)}
              </div>
              <p className="mt-3 text-center text-xs text-[#737373]">{gameOver ? "Nice game. Your board is saved in chat." : "Get three in a row to win."}</p>
              {error ? <p className="mt-3 text-center text-xs text-[#d62964]">{error}</p> : null}
            </div>;
          })() : null}

          {isRankTheseGame && !allAnswered && currentQuestion && !waiting ? <div className="mt-5 space-y-2">
            <p className="text-sm text-[#737373]">Use the arrows to move your favorite to the top.</p>
            {ranking.map((key, index) => {
              const option = options.find((item) => item.key === key);
              if (!option) return null;
              return <div className="flex items-center gap-2 rounded-[14px] border border-[#e7e7e7] bg-[#fafafa] p-3" key={key}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff3f7] text-sm font-bold text-[#e1306c]">{index + 1}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-[#262626]">{option.text}</span>
                <button aria-label={`Move ${option.text} up`} className="h-9 w-9 rounded-full border border-[#dbdbdb] bg-white text-lg disabled:opacity-30" disabled={index === 0} onClick={() => moveRankedItem(index, -1)} type="button">↑</button>
                <button aria-label={`Move ${option.text} down`} className="h-9 w-9 rounded-full border border-[#dbdbdb] bg-white text-lg disabled:opacity-30" disabled={index === ranking.length - 1} onClick={() => moveRankedItem(index, 1)} type="button">↓</button>
              </div>;
            })}
            <button className="mt-2 w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={submitting || waiting || ranking.length !== options.length} onClick={handleRankSubmit} type="button">{submitting ? "Saving…" : "Lock in my ranking"}</button>
          </div> : null}

          {!isStoryGame && !isCaptionGame && !isEmojiDecodeGame && !isCipherBreakerGame && !isPhotoScavengerGame && !isRankTheseGame && !isTicTacToeGame && !allAnswered && currentQuestion ? <div className={`mt-5 grid gap-3 ${options.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {options.map((option) => (
              <button
                className="rounded-[14px] border border-[#dbdbdb] bg-[#fafafa] px-4 py-5 text-center text-[1.1rem] font-bold leading-tight text-[#262626] transition-all duration-200 hover:border-[#0095f6] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:text-[1.3rem]"
                data-testid="game-option-button"
                disabled={submitting || waiting}
                key={option.key}
                onClick={() => handleOptionClick(option)}
                type="button"
              >
                {option.text}
              </button>
            ))}
          </div> : null}

          {(isTruthLieGame ? truthLieGuessed : waiting || allAnswered) ? (
            <div className="mt-5 rounded-2xl bg-[#fff3f7] px-4 py-5 text-center">
              <p className="text-sm font-semibold text-[#a52b55]">{isPhotoScavengerGame ? "Your photo is locked in 📸" : isTruthLieGame ? "Your guess is locked in ✨" : isCaptionGame ? "Your captions are locked in ✨" : isRankTheseGame ? "Your ranking is locked in ✨" : isStoryGame ? "Your story lines are saved ✨" : "All your picks are saved ✨"}</p>
              <p className="mt-1 text-sm text-[#7d5261]">{isPhotoScavengerGame ? "Your photo stays private until your match shares theirs. Keep chatting in the meantime." : isTruthLieGame ? "Your guess is saved. The lies reveal once your match has guessed too." : isCaptionGame ? "Your captions stay private until your match captions all three scenes." : isRankTheseGame ? "Your order stays private until your match submits theirs. Then you can compare every spot." : isStoryGame ? "Your lines stay private until your match finishes. Keep chatting in the meantime." : "Your answers stay private until your match finishes all five. Keep chatting in the meantime."}</p>
              <button
                className="mt-4 rounded-full border border-[#e8bdcc] bg-white px-4 py-2 text-sm font-semibold text-[#a52b55]"
                onClick={onClose}
                type="button"
              >
                Back to chat
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-xs text-[#d62964]">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
