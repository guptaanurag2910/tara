import { useEffect, useMemo, useState } from "react";

import {
  fetchQuestions,
  saveBasicProfile,
  saveBirthDetails,
  submitResponse,
} from "../services/onboardingService";

const STEP_BASIC = "basic";
const STEP_BIRTH = "birth";
const STEP_PERSONALITY = "personality";
const STEP_DONE = "done";

const ONBOARDING_PROGRESS_KEY = "tara_onboarding_progress";

function loadProgress() {
  const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
    return null;
  }
}

function persistProgress(progress) {
  localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
}

function clearProgress() {
  localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
}

export function useOnboardingFlow({ initialUser = null, onComplete }) {
  const persisted = loadProgress();

  const [step, setStep] = useState(persisted?.step || STEP_BASIC);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [basicForm, setBasicForm] = useState(
    persisted?.basicForm || {
      name: initialUser?.name || "",
      date_of_birth: initialUser?.date_of_birth || "",
      gender: initialUser?.gender || "female",
      preference: initialUser?.preference || "male",
    }
  );

  const [birthForm, setBirthForm] = useState(
    persisted?.birthForm || {
      latitude: initialUser?.latitude ? String(initialUser.latitude) : "",
      longitude: initialUser?.longitude ? String(initialUser.longitude) : "",
      birth_time: initialUser?.birth_time || "",
    }
  );

  const [questions, setQuestions] = useState(persisted?.questions || []);
  const [questionIndex, setQuestionIndex] = useState(persisted?.questionIndex || 0);
  const [responsesByQuestion, setResponsesByQuestion] = useState(persisted?.responsesByQuestion || {});

  const currentQuestion = questions[questionIndex] || null;
  const hasExistingBasicInfo = Boolean(
    initialUser?.name && initialUser?.date_of_birth && initialUser?.gender && initialUser?.preference
  );
  const hasExistingBirthInfo = Boolean(initialUser?.latitude && initialUser?.longitude);

  useEffect(() => {
    if (step === STEP_DONE) {
      clearProgress();
      return;
    }

    persistProgress({
      step,
      basicForm,
      birthForm,
      questions,
      questionIndex,
      responsesByQuestion,
    });
  }, [step, basicForm, birthForm, questions, questionIndex, responsesByQuestion]);

  const setBasicField = (event) => {
    const { name, value } = event.target;
    setBasicForm((prev) => ({ ...prev, [name]: value }));
  };

  const setBirthField = (event) => {
    const { name, value } = event.target;
    setBirthForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateBasic = () => {
    if (!basicForm.name || !basicForm.date_of_birth || !basicForm.gender || !basicForm.preference) {
      return "Please complete all basic details.";
    }
    return "";
  };

  const validateBirth = () => {
    const lat = Number(birthForm.latitude);
    const lng = Number(birthForm.longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return "Please enter valid latitude and longitude.";
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return "Latitude must be -90 to 90 and longitude must be -180 to 180.";
    }

    return "";
  };

  const goToBirthStep = async () => {
    const validationError = validateBasic();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    try {
      await saveBasicProfile(basicForm);
      setStep(STEP_BIRTH);
    } catch (apiError) {
      setError(apiError.message || "Could not save basic profile.");
    } finally {
      setLoading(false);
    }
  };

  const goToPersonalityStep = async () => {
    const validationError = validateBirth();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        latitude: birthForm.latitude,
        longitude: birthForm.longitude,
      };

      if (birthForm.birth_time) {
        payload.birth_time = birthForm.birth_time;
      }

      await saveBirthDetails(payload);

      const loadedQuestions = await fetchQuestions();
      setQuestions(loadedQuestions);
      setQuestionIndex(0);
      setStep(STEP_PERSONALITY);
    } catch (apiError) {
      setError(apiError.message || "Could not save birth details.");
    } finally {
      setLoading(false);
    }
  };

  const autoDetectLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Location detection is not available on this device.");
      return;
    }

    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBirthForm((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude.toFixed(6)),
          longitude: String(position.coords.longitude.toFixed(6)),
        }));
      },
      () => {
        setError("Could not fetch your location. Please enter it manually.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const selectPersonalityOption = async (optionId) => {
    if (!currentQuestion || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      setResponsesByQuestion((prev) => ({ ...prev, [currentQuestion.id]: optionId }));

      if (typeof currentQuestion.id === "number") {
        await submitResponse({
          question_id: currentQuestion.id,
          option_id: optionId,
        });
      }

      const isLastQuestion = questionIndex >= questions.length - 1;

      if (!isLastQuestion) {
        setTimeout(() => {
          setQuestionIndex((prev) => prev + 1);
          setLoading(false);
        }, 180);
        return;
      }

      if (onComplete) {
        await onComplete();
      }

      setStep(STEP_DONE);
      setLoading(false);
    } catch (apiError) {
      setLoading(false);
      setError(apiError.message || "Could not save answer.");
    }
  };

  const goBackStep = () => {
    setError("");
    if (step === STEP_PERSONALITY) {
      if (questionIndex > 0) {
        setQuestionIndex((prev) => prev - 1);
        return;
      }
      setStep(STEP_BIRTH);
      return;
    }
    if (step === STEP_BIRTH) {
      setStep(STEP_BASIC);
    }
  };

  const personalityProgress = useMemo(
    () => ({
      current: questionIndex + 1,
      total: questions.length || 7,
    }),
    [questionIndex, questions.length]
  );

  return {
    step,
    loading,
    error,
    basicForm,
    birthForm,
    currentQuestion,
    responsesByQuestion,
    personalityProgress,
    setBasicField,
    setBirthField,
    goToBirthStep,
    goToPersonalityStep,
    autoDetectLocation,
    selectPersonalityOption,
    goBackStep,
    hasExistingBasicInfo,
    hasExistingBirthInfo,
  };
}
