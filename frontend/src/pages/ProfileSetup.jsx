import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import LocationInput from "../components/LocationInput";
import BirthTimeClock from "../components/BirthTimeClock";
import {
  fetchQuestions,
  fetchProfilePhotos,
  fetchProfileSummary,
  saveBasicProfile,
  saveBirthDetails,
  deleteProfilePhoto,
  submitResponse,
  uploadProfilePhoto,
} from "../services/onboardingService";
import {
  getOnboardingProfile,
  isGeneratedPhoneName,
  markOnboardingComplete,
  saveOnboardingProfile,
} from "../services/onboardingStorage";

const STEP_NAME = 0;
const STEP_DOB = 1;
const STEP_GENDER = 2;
const STEP_PREFERENCE = 3;
const STEP_PLACE = 4;
const STEP_TIME = 5;
const STEP_PHOTOS = 6;
const STEP_PERSONALITY = 7;
const STEP_VIBE = 8;

const PERSONALITY_QUESTION_LIMIT = 3;
const TOTAL_PROGRESS_UNITS = 10;
const MAX_PROFILE_PHOTOS = 5;

function isPastDate(dobText) {
  if (!dobText) {
    return false;
  }
  const dob = new Date(dobText);
  if (Number.isNaN(dob.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dob < today;
}

function isAdult(dobText) {
  if (!dobText) {
    return false;
  }
  const dob = new Date(dobText);
  if (Number.isNaN(dob.getTime())) {
    return false;
  }
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const hadBirthday =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  return hadBirthday ? age >= 18 : age - 1 >= 18;
}

function getDobValidationMessage(dobText) {
  if (!dobText) {
    return "";
  }
  if (!isPastDate(dobText)) {
    return "Date of birth must be in the past.";
  }
  if (!isAdult(dobText)) {
    return "You must be 18+ to use Tara.";
  }
  return "";
}

function toPositiveInteger(value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }
  return null;
}

function sentenceCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePhotoItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      if (!item) {
        return null;
      }

      if (typeof item === "string") {
        return { id: `local-${index}-${Date.now()}`, src: item };
      }

      const src = item.src || item.image_url || "";
      if (!src) {
        return null;
      }

      return {
        id: item.id ?? `local-${index}-${Date.now()}`,
        src,
      };
    })
    .filter(Boolean);
}

function normalizeResponsesMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((acc, [questionId, optionId]) => {
    const normalizedQuestionId = toPositiveInteger(questionId);
    const normalizedOptionId = toPositiveInteger(optionId);
    if (normalizedQuestionId && normalizedOptionId) {
      acc[String(normalizedQuestionId)] = normalizedOptionId;
    }
    return acc;
  }, {});
}

function normalizeStoredStep(value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= STEP_NAME && numeric <= STEP_VIBE) {
    return numeric;
  }
  return null;
}

function deriveInitialStep(storedProfile) {
  const storedStep = normalizeStoredStep(storedProfile?.currentStep);
  if (storedStep !== null) {
    return storedStep;
  }

  if (!String(storedProfile?.name || "").trim()) {
    return STEP_NAME;
  }
  if (!String(storedProfile?.date_of_birth || "").trim()) {
    return STEP_DOB;
  }
  if (!String(storedProfile?.gender || "").trim()) {
    return STEP_GENDER;
  }
  if (!String(storedProfile?.preference || "").trim()) {
    return STEP_PREFERENCE;
  }

  const hasBirthLocation =
    String(storedProfile?.birth_place || "").trim().length > 0 &&
    String(storedProfile?.latitude || "").trim().length > 0 &&
    String(storedProfile?.longitude || "").trim().length > 0;
  if (!hasBirthLocation) {
    return STEP_PLACE;
  }

  if (!storedProfile?.birthSaved) {
    return STEP_TIME;
  }

  if (!Array.isArray(storedProfile?.photos) || storedProfile.photos.length === 0) {
    return STEP_PHOTOS;
  }

  return STEP_PERSONALITY;
}

function normalizeTraitCards(traits, name) {
  const fallback = [
    {
      key: "intuitive",
      title: "Intuitive",
      note: "You feel before you think.",
    },
    {
      key: "romantic",
      title: "Romantic",
      note: "You believe in slow, deep love.",
    },
    {
      key: "curious",
      title: "Curious",
      note: "You ask the questions others avoid.",
    },
    {
      key: "grounded",
      title: "Grounded",
      note: "Steady when the world isn\'t.",
    },
  ];

  if (!traits || typeof traits !== "object" || !Object.keys(traits).length) {
    return {
      greetingName: name || "there",
      cards: fallback,
    };
  }

  const notes = {
    overthinking: "Your mind catches details others miss.",
    emotional_depth: "You connect through emotional honesty.",
    communication: "You value clarity over confusion.",
    stability: "People feel calm around you.",
    openness: "You give new people a fair chance.",
    empathy: "You naturally tune into emotions.",
  };

  const sorted = Object.entries(traits)
    .map(([key, value]) => ({ key, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((entry) => ({
      key: entry.key,
      title: sentenceCase(entry.key),
      note: notes[entry.key] || "A core part of your emotional vibe.",
    }));

  return {
    greetingName: name || "there",
    cards: sorted.length ? sorted : fallback,
  };
}

function OptionRow({ selected, label, onClick }) {
  return (
    <button className={`tara-option-card ${selected ? "active" : ""}`} onClick={onClick} type="button">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[18px] font-medium leading-tight">{label}</span>
        <span className="tara-option-dot">{selected ? "✓" : ""}</span>
      </div>
    </button>
  );
}

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, fetchCurrentUser } = useAuth();
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const stored = getOnboardingProfile(user?.id);
  const initialName =
    stored.name || (isGeneratedPhoneName(user) ? "" : user?.name || "");
  const [step, setStep] = useState(() => deriveInitialStep(stored));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({
    name: initialName,
    date_of_birth: stored.date_of_birth || user?.date_of_birth || "",
    gender: stored.gender || user?.gender || "",
    preference: stored.preference || user?.preference || "",
    birth_place: stored.birth_place || user?.birth_place || "",
    birth_time: stored.birth_time || user?.birth_time || "",
    latitude: stored.latitude || (user?.latitude ? String(user.latitude) : ""),
    longitude: stored.longitude || (user?.longitude ? String(user.longitude) : ""),
    is_default_location: Boolean(
      stored.is_default_location !== undefined
        ? stored.is_default_location
        : user?.is_default_location
    ),
    photos: normalizePhotoItems(stored.photos),
    basicSaved: Boolean(stored.basicSaved),
    birthSaved: Boolean(stored.birthSaved),
  });

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(() => {
    const numeric = Number(stored.currentQuestionIndex);
    return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
  });
  const [responsesByQuestion, setResponsesByQuestion] = useState(() =>
    normalizeResponsesMap(stored.responsesByQuestion),
  );
  const [vibeSummary, setVibeSummary] = useState(() => normalizeTraitCards({}, stored.name || user?.name));

  useEffect(() => {
    const persisted = getOnboardingProfile(user?.id);
    if (persisted?.completed && persisted?.basicSaved && persisted?.birthSaved) {
      return;
    }

    saveOnboardingProfile({
      ...profile,
      currentStep: step,
      currentQuestionIndex: step === STEP_PERSONALITY ? questionIndex : 0,
      responsesByQuestion,
      completed: false,
      completedAt: null,
    }, user?.id);
  }, [profile, questionIndex, responsesByQuestion, step, user?.id]);

  useEffect(() => {
    let active = true;
    fetchProfilePhotos()
      .then((photos) => {
        if (!active || !Array.isArray(photos) || photos.length === 0) {
          return;
        }

        setProfile((prev) => {
          if (Array.isArray(prev.photos) && prev.photos.length > 0) {
            return prev;
          }
          return {
            ...prev,
            photos: photos.map((photo) => ({
              id: photo.id,
              src: photo.image_url,
            })),
          };
        });
      })
      .catch(() => {
        // Optional hydration only.
      });

    return () => {
      active = false;
    };
  }, []);

  const currentQuestion = questions[questionIndex] || null;
  const selectedOptionId = currentQuestion ? responsesByQuestion[String(currentQuestion.id)] : null;

  useEffect(() => {
    if (!questions.length) {
      return;
    }
    setQuestionIndex((prev) => Math.min(Math.max(prev, 0), questions.length - 1));
  }, [questions]);

  const progressUnit = useMemo(() => {
    if (step <= STEP_PHOTOS) {
      return step + 1;
    }
    if (step === STEP_PERSONALITY) {
      return 7 + questionIndex + 1;
    }
    return TOTAL_PROGRESS_UNITS;
  }, [questionIndex, step]);

  const progressPercent = useMemo(
    () => Math.min(100, Math.max(0, (progressUnit / TOTAL_PROGRESS_UNITS) * 100)),
    [progressUnit],
  );

  const clientValidationMessage = useMemo(() => {
    if (step === STEP_NAME && profile.name.length > 0 && !profile.name.trim()) {
      return "Please enter your first name.";
    }
    if (step === STEP_DOB) {
      return getDobValidationMessage(profile.date_of_birth);
    }
    return "";
  }, [profile.date_of_birth, profile.name, step]);

  const canProceed = useMemo(() => {
    if (step === STEP_NAME) {
      return profile.name.trim().length > 0;
    }
    if (step === STEP_DOB) {
      return Boolean(profile.date_of_birth) && isAdult(profile.date_of_birth);
    }
    if (step === STEP_GENDER) {
      return Boolean(profile.gender);
    }
    if (step === STEP_PREFERENCE) {
      return Boolean(profile.preference);
    }
    if (step === STEP_PLACE) {
      return (
        String(profile.birth_place || "").trim().length > 0 &&
        String(profile.latitude || "").trim().length > 0 &&
        String(profile.longitude || "").trim().length > 0
      );
    }
    if (step === STEP_TIME) {
      return true;
    }
    if (step === STEP_PHOTOS) {
      return Array.isArray(profile.photos) && profile.photos.length > 0;
    }
    if (step === STEP_PERSONALITY) {
      return Boolean(selectedOptionId);
    }
    return true;
  }, [profile, selectedOptionId, step]);

  const saveBasicIfNeeded = async () => {
    if (profile.basicSaved) {
      return;
    }
    await saveBasicProfile({
      name: profile.name.trim(),
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      preference: profile.preference,
    });
    setProfile((prev) => ({ ...prev, basicSaved: true }));
  };

  const syncBirthDetails = async () => {
    const birthPlace = String(profile.birth_place || "").trim();
    const latitude = String(profile.latitude || "").trim();
    const longitude = String(profile.longitude || "").trim();

    if (!birthPlace) {
      throw new Error("Please enter your place of birth.");
    }

    const payload = {
      date_of_birth: profile.date_of_birth,
      place_of_birth: birthPlace,
      is_default_location: Boolean(profile.is_default_location),
    };
    if (latitude && longitude) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }

    if (profile.birth_time) {
      payload.time_of_birth = profile.birth_time;
    }

    const savedBirth = await saveBirthDetails(payload);
    setProfile((prev) => ({
      ...prev,
      birthSaved: true,
      birth_place: savedBirth.birth_place || birthPlace || prev.birth_place,
      birth_time: savedBirth.birth_time || profile.birth_time || "",
      latitude: String(savedBirth.latitude ?? prev.latitude ?? latitude),
      longitude: String(savedBirth.longitude ?? prev.longitude ?? longitude),
      is_default_location:
        savedBirth.is_default_location !== undefined
          ? Boolean(savedBirth.is_default_location)
          : prev.is_default_location,
    }));
  };

  const loadQuestionsIfNeeded = async () => {
    if (questions.length > 0) {
      return;
    }
    const loaded = await fetchQuestions();
    const sliced = Array.isArray(loaded) ? loaded.slice(0, PERSONALITY_QUESTION_LIMIT) : [];
    if (!sliced.length) {
      throw new Error("Could not load personality questions.");
    }
    setQuestions(sliced);
  };

  useEffect(() => {
    if (step < STEP_PERSONALITY) {
      return;
    }

    let active = true;
    (async () => {
      try {
        await loadQuestionsIfNeeded();
      } catch {
        return;
      }

      try {
        const summary = await fetchProfileSummary();
        if (!active) {
          return;
        }

        const responseMap = Array.isArray(summary?.personality_responses)
          ? summary.personality_responses.reduce((acc, item) => {
              const questionId = toPositiveInteger(item?.question_id);
              const optionId = toPositiveInteger(item?.selected_option?.id);
              if (questionId && optionId) {
                acc[String(questionId)] = optionId;
              }
              return acc;
            }, {})
          : {};

        if (Object.keys(responseMap).length > 0) {
          setResponsesByQuestion((prev) => ({
            ...responseMap,
            ...prev,
          }));
        }

        if (summary?.traits && typeof summary.traits === "object") {
          setVibeSummary(normalizeTraitCards(summary.traits || {}, profile.name));
        }
      } catch {
        if (active && step === STEP_VIBE) {
          setVibeSummary(normalizeTraitCards({}, profile.name));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [profile.name, step]); // intentionally rehydrate when resuming personality/vibe

  const onPhotoSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const remainingSlots = Math.max(0, MAX_PROFILE_PHOTOS - profile.photos.length);
      const uploadFiles = files.slice(0, remainingSlots);

      if (!uploadFiles.length) {
        setError(`You can upload up to ${MAX_PROFILE_PHOTOS} photos.`);
        return;
      }

      const createdPhotos = [];
      for (const file of uploadFiles) {
        const created = await uploadProfilePhoto(file);
        createdPhotos.push({
          id: created.id,
          src: created.image_url,
        });
      }

      setProfile((prev) => ({
        ...prev,
        photos: [...prev.photos, ...createdPhotos],
      }));
    } catch (apiError) {
      setError(apiError?.message || "Could not upload photo. Please try again.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const onRemovePhoto = async (photoId) => {
    setLoading(true);
    setError("");
    try {
      const numericId = Number(photoId);
      if (Number.isInteger(numericId)) {
        await deleteProfilePhoto(numericId);
      }

      setProfile((prev) => ({
        ...prev,
        photos: prev.photos.filter((photo) => String(photo.id) !== String(photoId)),
      }));
    } catch (apiError) {
      setError(apiError?.message || "Could not remove photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onBirthLocationChange = (locationPayload) => {
    setProfile((prev) => ({
      ...prev,
      birth_place: String(locationPayload?.place_of_birth || ""),
      latitude: String(locationPayload?.latitude || ""),
      longitude: String(locationPayload?.longitude || ""),
      is_default_location: Boolean(locationPayload?.is_default_location),
      birthSaved: false,
    }));
  };

  const onBack = () => {
    setError("");

    if (step === STEP_PERSONALITY && questionIndex > 0) {
      setQuestionIndex((prev) => prev - 1);
      return;
    }

    if (step === STEP_VIBE) {
      setStep(STEP_PERSONALITY);
      setQuestionIndex(Math.max(questions.length - 1, 0));
      return;
    }

    if (step > STEP_NAME) {
      setStep((prev) => prev - 1);
      return;
    }

    navigate("/welcome");
  };

  const completeOnboarding = async () => {
    markOnboardingComplete({
      ...profile,
      currentStep: STEP_VIBE,
      currentQuestionIndex: Math.max(questionIndex, 0),
      completed: true,
      completedAt: Date.now(),
    }, user?.id);
    await fetchCurrentUser();
    navigate("/discover", { replace: true });
  };

  const onNext = async () => {
    if (!canProceed || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (step === STEP_DOB && !isAdult(profile.date_of_birth)) {
        throw new Error("You must be 18+ to use Tara.");
      }

      if (step === STEP_PREFERENCE) {
        await saveBasicIfNeeded();
        setStep(STEP_PLACE);
        setLoading(false);
        return;
      }

      if (step === STEP_TIME) {
        await syncBirthDetails();
        setStep(STEP_PHOTOS);
        setLoading(false);
        return;
      }

      if (step === STEP_PHOTOS) {
        await loadQuestionsIfNeeded();
        setStep(STEP_PERSONALITY);
        setLoading(false);
        return;
      }

      if (step === STEP_PERSONALITY) {
        const questionId = toPositiveInteger(currentQuestion?.id);
        const optionId = toPositiveInteger(selectedOptionId);

        if (questionId && optionId) {
          await submitResponse({
            question_id: questionId,
            option_id: optionId,
          });
        }

        const isLastQuestion = questionIndex >= questions.length - 1;
        if (!isLastQuestion) {
          setQuestionIndex((prev) => prev + 1);
          setLoading(false);
          return;
        }

        try {
          const summary = await fetchProfileSummary();
          setVibeSummary(normalizeTraitCards(summary?.traits || {}, profile.name));
        } catch {
          setVibeSummary(normalizeTraitCards({}, profile.name));
        }

        setStep(STEP_VIBE);
        setLoading(false);
        return;
      }

      if (step === STEP_VIBE) {
        await completeOnboarding();
        setLoading(false);
        return;
      }

      setStep((prev) => prev + 1);
      setLoading(false);
    } catch (apiError) {
      setLoading(false);
      setError(apiError?.message || "Could not save your profile right now.");
    }
  };

  const personalityLabel = `${questionIndex + 1} of ${Math.max(questions.length, PERSONALITY_QUESTION_LIMIT)}`;

  return (
    <main className="tara-container flex min-h-[100dvh] flex-col px-6 pb-8 pt-10">
      <header className="mb-10 flex items-center gap-4">
        <button aria-label="Back" className="tara-back-btn" onClick={onBack} type="button">
          ←
        </button>
        <div className="tara-progress-track flex-1">
          <div className="tara-progress-fill h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      <section className="onboarding-step-enter flex flex-1 flex-col">
        {step === STEP_NAME ? (
          <>
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] text-[color:var(--tara-gold)]">
              ◉
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">What should we call you?</h1>
            <p className="tara-copy mt-2 text-[15px]">Your first name is how others will know you.</p>
            <div className="mt-8">
              <input
                className="w-full border-0 border-b border-[color:var(--tara-card-border)] bg-transparent pb-3 text-[2.5rem] text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:border-b-[color:var(--tara-violet)] focus:outline-none"
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, name: event.target.value, basicSaved: false }))
                }
                placeholder="Your name"
                type="text"
                value={profile.name}
              />
            </div>
          </>
        ) : null}

        {step === STEP_DOB ? (
          <>
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] text-[color:var(--tara-gold)]">
              ☷
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">When were you born?</h1>
            <p className="tara-copy mt-2 text-[15px]">Your birth date shapes your kundali.</p>
            <div className="mt-8">
              <input
                className="tara-input"
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    date_of_birth: event.target.value,
                    basicSaved: false,
                  }))
                }
                type="date"
                value={profile.date_of_birth}
              />
            </div>
          </>
        ) : null}

        {step === STEP_GENDER ? (
          <>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">I identify as</h1>
            <p className="tara-copy mt-2 text-[15px]">This helps us understand you.</p>

            <div className="mt-8 space-y-3">
              {[
                { value: "female", label: "Woman" },
                { value: "male", label: "Man" },
                { value: "other", label: "Non-binary" },
                { value: "prefer_not_to_say", label: "Prefer not to say" },
              ].map((item) => (
                <OptionRow
                  key={item.value}
                  label={item.label}
                  onClick={() => setProfile((prev) => ({ ...prev, gender: item.value, basicSaved: false }))}
                  selected={profile.gender === item.value}
                />
              ))}
            </div>
          </>
        ) : null}

        {step === STEP_PREFERENCE ? (
          <>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">I&apos;m looking to meet</h1>
            <p className="tara-copy mt-2 text-[15px]">You can change this anytime.</p>

            <div className="mt-8 space-y-3">
              {[
                { value: "female", label: "Women" },
                { value: "male", label: "Men" },
                { value: "everyone", label: "Everyone" },
              ].map((item) => (
                <OptionRow
                  key={item.value}
                  label={item.label}
                  onClick={() => setProfile((prev) => ({ ...prev, preference: item.value, basicSaved: false }))}
                  selected={profile.preference === item.value}
                />
              ))}
            </div>
          </>
        ) : null}

        {step === STEP_PLACE ? (
          <>
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] text-[color:var(--tara-gold)]">
              ⌖
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">Where were you born?</h1>
            <p className="tara-copy mt-2 text-[15px]">Use current location or search and select a birthplace.</p>

            <div className="mt-7 space-y-3">
              <LocationInput
                value={{
                  place_of_birth: profile.birth_place,
                  latitude: profile.latitude,
                  longitude: profile.longitude,
                  is_default_location: profile.is_default_location,
                }}
                onChange={onBirthLocationChange}
                placeholder="Search city or place"
              />
            </div>
          </>
        ) : null}

        {step === STEP_TIME ? (
          <>
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] text-[color:var(--tara-gold)]">
              ◷
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">Time of birth</h1>
            <p className="tara-copy mt-2 text-[15px]">Optional - but it sharpens your chart.</p>
            <div className="mt-8">
              <BirthTimeClock
                label="Set birth time"
                manualInputId="profile-setup-birth-time"
                onChange={(nextTime) =>
                  setProfile((prev) => ({
                    ...prev,
                    birth_time: nextTime,
                    birthSaved: false,
                  }))
                }
                value={profile.birth_time}
              />
            </div>
            <p className="tara-faint mt-3 text-sm">
              If skipped, we use your profile creation time and current location.
            </p>
          </>
        ) : null}

        {step === STEP_PHOTOS ? (
          <>
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] text-[color:var(--tara-gold)]">
              ⊙
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">Add your photos</h1>
            <p className="tara-copy mt-2 text-[15px]">
              Upload at least one photo to continue. You can add up to {MAX_PROFILE_PHOTOS}.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                className="tara-secondary-btn w-full !h-[54px] !min-h-0 !text-[14px]"
                onClick={() => galleryInputRef.current?.click()}
                type="button"
              >
                Upload from gallery
              </button>
              <button
                className="tara-secondary-btn w-full !h-[54px] !min-h-0 !text-[14px]"
                onClick={() => cameraInputRef.current?.click()}
                type="button"
              >
                Use camera
              </button>
            </div>

            <input
              ref={galleryInputRef}
              accept="image/*"
              className="hidden"
              multiple
              onChange={onPhotoSelect}
              type="file"
            />
            <input
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPhotoSelect}
              type="file"
            />

            <div className="mt-6 grid grid-cols-3 gap-3">
              {profile.photos.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-2xl border border-[color:var(--tara-card-border)]">
                  <img alt="Profile upload" className="h-28 w-full object-cover" src={photo.src} />
                  <button
                    className="absolute right-1 top-1 rounded-full bg-black/55 px-2 py-1 text-xs text-white"
                    onClick={() => onRemovePhoto(photo.id)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <p className="tara-faint mt-3 text-sm">Profiles with photos get more meaningful matches.</p>
          </>
        ) : null}

        {step === STEP_PERSONALITY ? (
          <>
            <p className="tara-kicker">Personality · {personalityLabel}</p>
            <h1 className="tara-heading mt-2 text-[3.2rem] leading-[1.06]">
              {currentQuestion?.question_text || "Loading your question..."}
            </h1>

            <div className="mt-8 space-y-3">
              {(currentQuestion?.options || []).map((option) => (
                <OptionRow
                  key={option.id}
                  label={option.option_text}
                  onClick={() => {
                    setResponsesByQuestion((prev) => ({
                      ...prev,
                      [String(currentQuestion.id)]: option.id,
                    }));
                  }}
                  selected={selectedOptionId === option.id}
                />
              ))}
            </div>
          </>
        ) : null}

        {step === STEP_VIBE ? (
          <>
            <p className="tara-kicker">Your vibe</p>
            <h1 className="tara-heading mt-2 text-[3.3rem] leading-[1.04]">
              Welcome,{" "}
              <span className="bg-gradient-to-r from-[#6f63f7] via-[#5f6df6] to-[#d5bb76] bg-clip-text italic text-transparent">
                {vibeSummary.greetingName}
              </span>
            </h1>
            <p className="tara-copy mt-2 text-[15px]">We&apos;ve read your chart. Here&apos;s the energy you bring.</p>

            <div className="mt-7 space-y-3">
              {vibeSummary.cards.map((item) => (
                <article className="tara-card-strong vibe-card rounded-[30px] px-5 py-4" key={item.key}>
                  <p className="tara-heading text-[24px] leading-none">
                    <span className="mr-2 text-[color:var(--tara-gold)]">✧</span>
                    {item.title}
                  </p>
                  <p className="tara-copy mt-1 text-[15px]">{item.note}</p>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {!error && clientValidationMessage ? (
          <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {clientValidationMessage}
          </p>
        ) : null}

        <div className="mt-auto pt-10">
          <button className="tara-primary-btn w-full" disabled={!canProceed || loading} onClick={onNext} type="button">
            {loading ? "Saving..." : step === STEP_VIBE ? "Find my matches →" : "Continue →"}
          </button>
        </div>
      </section>
    </main>
  );
}
