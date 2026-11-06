import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { prepareRecommendations } from "../services/matchingService";
import LocationInput from "../components/LocationInput";
import {
  fetchProfilePhotos,
  saveBasicProfile,
  saveBirthDetails,
  deleteProfilePhoto,
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
const TOTAL_PROGRESS_UNITS = STEP_PHOTOS + 1;
const MAX_PROFILE_PHOTOS = 5;

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

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

function normalizeStoredStep(value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= STEP_NAME) {
    // Resume older drafts that had advanced into the removed personality screens at Photos.
    return Math.min(numeric, STEP_PHOTOS);
  }
  return null;
}

function deriveInitialStep(storedProfile) {
  const storedStep = normalizeStoredStep(storedProfile?.currentStep);
  if (storedStep !== null) {
    if (
      storedStep >= STEP_PLACE &&
      (!storedProfile?.birth_place || !storedProfile?.latitude || !storedProfile?.longitude || storedProfile?.is_default_location)
    ) {
      return STEP_PLACE;
    }
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

  return STEP_PHOTOS;
}

function OptionRow({ selected, label, onClick }) {
  return (
    <button className={`tara-option-card ${selected ? "active" : ""}`} onClick={onClick} type="button">
      <div className="flex items-center justify-between gap-3">
        <span className="onboarding-option-label text-[18px] font-medium leading-tight">{label}</span>
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
  const hasSelectedBirthplace = Boolean(
    stored.birth_place &&
    stored.latitude &&
    stored.longitude &&
    !stored.is_default_location &&
    (stored.birthPlaceConfirmed || normalizeStoredStep(stored.currentStep) > STEP_PLACE)
  );
  const [step, setStep] = useState(() => deriveInitialStep(stored));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({
    name: initialName,
    date_of_birth: stored.date_of_birth || user?.date_of_birth || "",
    gender: stored.gender || user?.gender || "",
    preference: stored.preference || user?.preference || "",
    birth_place: hasSelectedBirthplace ? stored.birth_place : "",
    birthPlaceConfirmed: hasSelectedBirthplace,
    birth_time: stored.birth_time || user?.birth_time || getCurrentTime(),
    latitude: hasSelectedBirthplace ? stored.latitude : "",
    longitude: hasSelectedBirthplace ? stored.longitude : "",
    is_default_location: false,
    photos: normalizePhotoItems(stored.photos),
    basicSaved: Boolean(stored.basicSaved),
    birthSaved: Boolean(stored.birthSaved),
  });

  useEffect(() => {
    const persisted = getOnboardingProfile(user?.id);
    if (persisted?.completed && persisted?.basicSaved && persisted?.birthSaved) {
      return;
    }

    saveOnboardingProfile({
      ...getOnboardingProfile(user?.id),
      ...profile,
      currentStep: step,
      currentQuestionIndex: 0,
      completed: false,
      completedAt: null,
    }, user?.id);
  }, [profile, step, user?.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

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

  const progressUnit = step + 1;

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
    return true;
  }, [profile, step]);

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
    const place = String(locationPayload?.place_of_birth || "");
    const latitude = String(locationPayload?.latitude || "");
    const longitude = String(locationPayload?.longitude || "");
    setProfile((prev) => ({
      ...prev,
      birth_place: place,
      birthPlaceConfirmed: Boolean(place && latitude && longitude && !locationPayload?.is_default_location),
      latitude,
      longitude,
      is_default_location: Boolean(locationPayload?.is_default_location),
      birthSaved: false,
    }));
  };

  const onBack = () => {
    setError("");

    if (step > STEP_NAME) {
      setStep((prev) => prev - 1);
      return;
    }

    navigate("/welcome");
  };

  const completeOnboarding = async () => {
    markOnboardingComplete({
      ...getOnboardingProfile(user?.id),
      ...profile,
      currentStep: STEP_PHOTOS,
      currentQuestionIndex: 0,
      completed: true,
      completedAt: Date.now(),
    }, user?.id);
    await fetchCurrentUser();
    try {
      await prepareRecommendations();
    } catch {
      // Discover retries job creation when it loads if this request fails.
    }
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

  return (
    <main className="tara-container tara-onboarding onboarding-profile">
      <header className="onboarding-header">
        <div className="onboarding-header-row">
          <button aria-label="Back" className="tara-back-btn" onClick={onBack} type="button">
            ←
          </button>
          <div className="onboarding-header-meta">
            <span className="onboarding-brand">tara<span className="onboarding-brand-dot">.</span></span>
            <span className="onboarding-step-count">{progressUnit} of {TOTAL_PROGRESS_UNITS}</span>
          </div>
        </div>
        <div aria-label="Onboarding progress" className="tara-progress-track" role="progressbar" aria-valuenow={progressUnit} aria-valuemin={0} aria-valuemax={TOTAL_PROGRESS_UNITS}>
          <div className="tara-progress-fill h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      <section className="onboarding-step-enter onboarding-content" key={step}>
        {step === STEP_NAME ? (
          <>
            <span className="onboarding-step-icon">
              ◉
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">What should we call you?</h1>
            <p className="tara-copy mt-2 text-[15px]">Your first name is how others will know you.</p>
            <div className="mt-8">
              <input
                aria-label="Your first name"
                className="onboarding-name-input"
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
            <span className="onboarding-step-icon">
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
                { value: "non_binary", label: "Non-binary" },
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
            <span className="onboarding-step-icon">
              ⌖
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">Where were you born?</h1>
            <p className="tara-copy mt-2 text-[15px]">Search for your birthplace and select it from the list.</p>

            <div className="mt-7 space-y-3">
              <LocationInput
                autoDetect={false}
                value={{
                  place_of_birth: profile.birth_place,
                  latitude: profile.latitude,
                  longitude: profile.longitude,
                  is_default_location: profile.is_default_location,
                }}
                onChange={onBirthLocationChange}
                placeholder="Search your place of birth"
                simple
              />
            </div>
          </>
        ) : null}

        {step === STEP_TIME ? (
          <>
            <span className="onboarding-step-icon">
              ◷
            </span>
            <h1 className="tara-heading text-[3.2rem] leading-[1.05]">Time of birth</h1>
            <p className="tara-copy mt-2 text-[15px]">We’ve filled in the current time. Change it to your birth time if you know it.</p>
            <div className="mt-8">
              <label className="block">
                <span className="mb-2 block text-sm font-medium tara-copy">Time</span>
                <input
                  className="tara-input w-full"
                  id="profile-setup-birth-time"
                  name="birth_time"
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      birth_time: event.target.value,
                      birthSaved: false,
                    }))
                  }
                  type="time"
                  value={profile.birth_time}
                />
              </label>
            </div>
          </>
        ) : null}

        {step === STEP_PHOTOS ? (
          <>
            <span className="onboarding-step-icon">
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

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {!error && clientValidationMessage ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {clientValidationMessage}
          </p>
        ) : null}

        <div className="onboarding-actions">
          <button className="tara-primary-btn w-full" disabled={!canProceed || loading} onClick={onNext} type="button">
            {loading ? "Saving..." : step === STEP_PHOTOS ? "Finish setup" : "Continue"}
          </button>
        </div>
      </section>
    </main>
  );
}
