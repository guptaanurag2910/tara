import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

import Loader from "../components/Loader";
import { PERSONALITY_TRAITS, describePersonalityScore } from "../lib/personalityScoring";
import { prepareRecommendations } from "../services/matchingService";
import { fetchActivePersonalityQuestions, fetchProfileSummary, submitResponse } from "../services/onboardingService";

const AGREEMENT_ORDER = ["strongly disagree", "disagree", "neutral", "agree", "strongly agree"];

function responseOptions(question) {
  const options = question?.options || [];
  const isAgreementScale = options.length === AGREEMENT_ORDER.length
    && options.every((option) => AGREEMENT_ORDER.includes(String(option.option_text).trim().toLowerCase()));
  return {
    isAgreementScale,
    options: isAgreementScale
      ? [...options].sort((left, right) => AGREEMENT_ORDER.indexOf(left.option_text.trim().toLowerCase()) - AGREEMENT_ORDER.indexOf(right.option_text.trim().toLowerCase()))
      : options,
  };
}

function responseMap(responses, questions) {
  const activeIds = new Set(questions.map((question) => Number(question.id)));
  return Object.fromEntries((Array.isArray(responses) ? responses : [])
    .filter((response) => activeIds.has(Number(response.question_id)) && response.selected_option?.id)
    .map((response) => [response.question_id, response.selected_option.id]));
}

function TraitResults({ traits }) {
  const bigFive = PERSONALITY_TRAITS.every((trait) => Number.isFinite(Number(traits?.[trait.key])));
  const rows = bigFive
    ? PERSONALITY_TRAITS.map((trait) => ({
      key: trait.key, label: trait.label, color: trait.color, score: Number(traits[trait.key]),
      note: describePersonalityScore(Math.round(((Number(traits[trait.key]) - 1) / 9) * 100), trait),
    }))
    : Object.entries(traits || {}).filter(([, value]) => Number.isFinite(Number(value))).map(([key, value]) => ({
      key, label: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      color: "#e1306c", score: Number(value), note: "One pattern in the answers you shared.",
    }));

  if (!rows.length) return <p className="vibe-error" role="alert">Your answers were saved, but results are not available yet. Please come back shortly.</p>;
  return (
    <div className="vibe-results">
      <div className="vibe-results-intro"><span className="vibe-results-icon"><Sparkles size={24} /></span><p className="vibe-eyebrow">YOUR VIBE SNAPSHOT</p><h2>A little more about you</h2><p>Patterns from your answers, not a label or a diagnosis.</p></div>
      <div className="vibe-traits">
        {rows.map((row) => <article className="vibe-trait" key={row.key}>
          <div className="vibe-trait-head"><span className="vibe-trait-mark" style={{ background: row.color }} /><h3>{row.label}</h3><strong>{row.score.toFixed(1)}<small> / 10</small></strong></div>
          <div aria-label={`${row.label}: ${row.score.toFixed(1)} out of 10`} className="vibe-trait-track" role="img"><span style={{ width: `${Math.max(0, Math.min(100, row.score * 10))}%`, background: row.color }} /></div>
          <p>{row.note}</p>
        </article>)}
      </div>
      <p className="vibe-results-note">These scores are for self-reflection. They are not percentiles or clinical assessments.</p>
    </div>
  );
}

export default function YourVibe() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingQuestionId, setSavingQuestionId] = useState(null);
  const [error, setError] = useState("");
  const [errorQuestionId, setErrorQuestionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [traits, setTraits] = useState({});
  const [mode, setMode] = useState("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const questionHeadingRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchActivePersonalityQuestions(), fetchProfileSummary()])
      .then(([loadedQuestions, profile]) => {
        if (!active) return;
        const currentQuestions = loadedQuestions.filter((question) => question.is_active !== false && question.options?.length);
        const savedAnswers = responseMap(profile?.personality_responses, currentQuestions);
        setQuestions(currentQuestions);
        setAnswers(savedAnswers);
        setTraits(profile?.traits || {});
        setMode(currentQuestions.length && currentQuestions.every((question) => savedAnswers[question.id]) ? "results" : "intro");
      })
      .catch((apiError) => { if (active) setError(apiError?.message || "Could not load your personality test."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== "quiz") return;
    questionHeadingRef.current?.focus({ preventScroll: true });
    questionHeadingRef.current?.scrollIntoView({ block: "nearest" });
  }, [mode, questionIndex]);

  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const currentQuestion = questions[questionIndex];
  const currentOptions = responseOptions(currentQuestion);
  const start = () => {
    if (!questions.length) return;
    setError("");
    setErrorQuestionId(null);
    const nextUnanswered = questions.findIndex((question) => !answers[question.id]);
    setQuestionIndex(nextUnanswered === -1 ? 0 : nextUnanswered);
    setMode("quiz");
  };
  const choose = async (questionId, optionId) => {
    if (savingQuestionId !== null) return;
    setSavingQuestionId(questionId);
    setError("");
    setErrorQuestionId(null);
    try {
      await submitResponse({ question_id: questionId, option_id: optionId });
      setAnswers((current) => ({ ...current, [questionId]: optionId }));
    } catch (apiError) {
      setError(apiError?.message || "Your answer could not be saved. Please try again.");
      setErrorQuestionId(questionId);
    } finally {
      setSavingQuestionId(null);
    }
  };
  const finish = async () => {
    if (answeredCount !== questions.length || savingQuestionId !== null) return;
    setLoading(true);
    setError("");
    try {
      const profile = await fetchProfileSummary();
      const savedAnswers = responseMap(profile?.personality_responses, questions);
      setAnswers(savedAnswers);
      if (!questions.every((item) => savedAnswers[item.id])) {
        setError("Some answers have not saved yet. Please try again.");
        const missingIndex = questions.findIndex((item) => !savedAnswers[item.id]);
        if (missingIndex !== -1) setQuestionIndex(missingIndex);
        return;
      }
      setTraits(profile?.traits || {});
      setMode("results");
      prepareRecommendations().catch(() => {});
    } catch (apiError) {
      setError(apiError?.message || "Could not load your results. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const next = () => {
    if (!currentQuestion || !answers[currentQuestion.id] || savingQuestionId !== null) return;
    setError("");
    setErrorQuestionId(null);
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else if (answeredCount === questions.length) {
      finish();
    } else {
      setQuestionIndex(questions.findIndex((item) => !answers[item.id]));
    }
  };

  return (
    <main className={`tara-vibe tara-container ${mode === "quiz" ? "is-quiz" : ""}`}>
      <header className="vibe-page-header">
        <div className="vibe-brand">tara<span>.</span></div>
        <button aria-label="Back to profile" className="vibe-back" disabled={savingQuestionId !== null} onClick={() => navigate("/profile")} type="button"><ArrowLeft size={19} /></button>
        <p className="vibe-eyebrow">GET TO KNOW YOU</p>
        <h1>Your Vibe</h1>
        <p>{mode === "quiz" ? "Read each statement and choose what feels closest. Your answers save as you go." : mode === "results" ? `Based on ${answeredCount} saved responses.` : "A space to reflect on what feels like you."}</p>
      </header>
      <div className="vibe-content">
        {loading ? <Loader text={mode === "quiz" ? "Reading your results..." : "Loading your vibe..."} /> : null}
        {!loading && mode === "intro" ? <section className="vibe-intro">
          <span className="vibe-intro-mark"><Sparkles size={25} /></span>
          <p className="vibe-eyebrow">OPTIONAL PERSONALITY TEST</p>
          <h2>{answeredCount ? "Pick up where you left off" : "Get to know your vibe"}</h2>
          <p>Explore {questions.length || "your"} statements about how you think, feel, and connect. Answers save to your profile, and you can leave at any time.</p>
          {answeredCount ? <span className="vibe-saved-count"><Check size={15} /> {answeredCount} of {questions.length} saved</span> : null}
          <button className="vibe-primary" disabled={!questions.length} onClick={start} type="button">{answeredCount ? "Continue test" : "Start personality test"} <ArrowRight size={18} /></button>
          {!questions.length ? <p className="vibe-muted">Questions are not available right now.</p> : null}
        </section> : null}
        {!loading && mode === "quiz" ? <section aria-label="Personality questionnaire" className="vibe-quiz">
          <div className="vibe-quiz-progress">
            <div className="vibe-quiz-top"><span>Question {questionIndex + 1} of {questions.length} / {answeredCount} saved</span><button disabled={savingQuestionId !== null} onClick={() => navigate("/profile")} type="button">Save and leave</button></div>
            <div aria-label="Test progress" aria-valuemax={questions.length} aria-valuemin={0} aria-valuenow={answeredCount} className="vibe-progress" role="progressbar"><span style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
          </div>
          {currentQuestion ? <>
            <section aria-labelledby={`vibe-question-label-${currentQuestion.id}`} className="vibe-question-row" key={currentQuestion.id}>
              <span className="vibe-question-number">{String(questionIndex + 1).padStart(2, "0")} / {questions.length}</span>
              <h2 id={`vibe-question-label-${currentQuestion.id}`} ref={questionHeadingRef} tabIndex={-1}>{currentQuestion.question_text}</h2>
              <p className="vibe-question-hint">How much does this sound like you?</p>
              {currentOptions.isAgreementScale ? <div className="vibe-scale">
                <span aria-hidden="true" className="vibe-scale-label is-disagree">Disagree</span>
                <div aria-label={`Response for ${currentQuestion.question_text}`} className="vibe-scale-options">
                  {currentOptions.options.map((option, optionIndex) => <button
                    aria-label={`${option.option_text} for ${currentQuestion.question_text}`}
                    aria-pressed={Number(answers[currentQuestion.id]) === Number(option.id)}
                    className={`vibe-scale-option vibe-scale-option-${optionIndex + 1} ${Number(answers[currentQuestion.id]) === Number(option.id) ? "is-selected" : ""}`}
                    disabled={savingQuestionId !== null}
                    key={option.id}
                    onClick={() => choose(currentQuestion.id, option.id)}
                    title={option.option_text}
                    type="button"
                  ><span /></button>)}
                </div>
                <span aria-hidden="true" className="vibe-scale-label is-neutral">Neutral</span>
                <span aria-hidden="true" className="vibe-scale-label is-agree">Agree</span>
              </div> : <div aria-label={`Response for ${currentQuestion.question_text}`} className="vibe-text-options">
                {currentOptions.options.map((option) => <button
                  aria-pressed={Number(answers[currentQuestion.id]) === Number(option.id)}
                  className={Number(answers[currentQuestion.id]) === Number(option.id) ? "is-selected" : ""}
                  disabled={savingQuestionId !== null}
                  key={option.id}
                  onClick={() => choose(currentQuestion.id, option.id)}
                  type="button"
                >{option.option_text}</button>)}
              </div>}
              <p aria-live="polite" className="vibe-choice-status">{savingQuestionId === currentQuestion.id ? "Saving answer..." : answers[currentQuestion.id] ? "Answer saved. You can change it before continuing." : "Choose one answer to continue."}</p>
              {errorQuestionId === currentQuestion.id ? <p className="vibe-question-error" role="alert">{error}</p> : null}
            </section>
            <div className="vibe-quiz-navigation">
              <button className="vibe-quiz-previous" disabled={questionIndex === 0 || savingQuestionId !== null} onClick={() => { setError(""); setErrorQuestionId(null); setQuestionIndex(questionIndex - 1); }} type="button"><ArrowLeft size={17} /> Back</button>
              <button className="vibe-primary vibe-quiz-next" disabled={!answers[currentQuestion.id] || savingQuestionId !== null} onClick={next} type="button">{questionIndex === questions.length - 1 ? answeredCount === questions.length ? "See results" : "Review unanswered" : "Next question"} <ArrowRight size={17} /></button>
            </div>
          </> : null}
        </section> : null}
        {!loading && mode === "results" ? <><TraitResults traits={traits} /><button className="vibe-primary vibe-see-matches" onClick={() => navigate("/matches")} type="button">See Matches <ArrowRight size={18} /></button></> : null}
        {error && errorQuestionId === null ? <p className="vibe-error" role="alert">{error}</p> : null}
      </div>
    </main>
  );
}
