import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Button from "../components/Button";
import Input from "../components/Input";
import { useAuth } from "../hooks/useAuth";
import {
  deleteProfilePhoto,
  fetchProfilePhotos,
  reorderProfilePhotos,
  saveBasicProfile,
  saveProfileExtras,
  uploadProfilePhoto,
} from "../services/onboardingService";
import {
  INTEREST_OPTIONS,
  clearProfileEditDraft,
  getProfileEditDraft,
  getProfileExtras,
  hydrateProfileExtrasFromOnboarding,
  isAdultDob,
  patchProfileExtras,
  saveProfileEditDraft,
} from "../services/profileService";

const SECTION_ORDER = ["name", "dob", "gender", "preferences", "photos", "bio", "interests"];
const MAX_PHOTOS = 5;

const SECTION_META = {
  name: {
    title: "Edit Name",
    subtitle: "How your name appears to matches",
  },
  dob: {
    title: "Edit Date of Birth",
    subtitle: "You must be 18+ to use Tara",
  },
  gender: {
    title: "Edit Gender",
    subtitle: "How you identify on your profile",
  },
  preferences: {
    title: "Edit Preferences",
    subtitle: "Who you are interested in",
  },
  photos: {
    title: "Edit Photos",
    subtitle: "Add, remove and reorder profile photos",
  },
  bio: {
    title: "Edit Bio",
    subtitle: "A short summary people see first",
  },
  interests: {
    title: "Edit Interests",
    subtitle: "Choose tags that improve profile quality",
  },
};

function mergeBasicFromUserAndDraft(user, draft) {
  return {
    name: draft?.name || user?.name || "",
    date_of_birth: draft?.date_of_birth || user?.date_of_birth || "",
    gender: draft?.gender || user?.gender || "",
    preference: draft?.preference || user?.preference || "",
  };
}

function updateItemAtIndex(list, index, nextValue) {
  return list.map((item, i) => (i === index ? nextValue : item));
}

export default function EditProfileSection() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { user, fetchCurrentUser } = useAuth();

  const isKnownSection = SECTION_ORDER.includes(section || "");
  const sectionMeta = SECTION_META[section] || SECTION_META.name;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [basic, setBasic] = useState(() => mergeBasicFromUserAndDraft(user, getProfileEditDraft(user?.id)));
  const [extras, setExtras] = useState(() => getProfileExtras(user?.id));

  useEffect(() => {
    if (!isKnownSection) {
      navigate("/profile/edit", { replace: true });
      return;
    }
    const hydrated = hydrateProfileExtrasFromOnboarding(user?.id);
    setExtras(hydrated);
    setBasic(mergeBasicFromUserAndDraft(user, getProfileEditDraft(user?.id)));
  }, [isKnownSection, navigate, user, user?.id]);

  useEffect(() => {
    let active = true;
    if (section !== "photos") {
      return () => {
        active = false;
      };
    }
    fetchProfilePhotos()
      .then((photos) => {
        if (!active || !Array.isArray(photos)) {
          return;
        }
        updateExtras({
          photos: photos.map((photo) => ({
            id: photo.id,
            src: photo.image_url,
          })),
        });
      })
      .catch(() => {
        // Keep edit screen usable even if fetch fails.
      });
    return () => {
      active = false;
    };
  }, [section]);

  useEffect(() => {
    if (!success) {
      return undefined;
    }
    const timer = window.setTimeout(() => setSuccess(""), 1200);
    return () => window.clearTimeout(timer);
  }, [success]);

  const sectionIndex = Math.max(SECTION_ORDER.indexOf(section || ""), 0);
  const stepLabel = `${sectionIndex + 1}/${SECTION_ORDER.length}`;

  const canSave = useMemo(() => {
    if (section === "name") {
      return String(basic.name || "").trim().length > 0;
    }
    if (section === "dob") {
      return Boolean(basic.date_of_birth);
    }
    if (section === "gender") {
      return Boolean(basic.gender);
    }
    if (section === "preferences") {
      return Boolean(basic.preference);
    }
    if (section === "photos") {
      return extras.photos.length > 0;
    }
    if (section === "bio") {
      return String(extras.bio || "").trim().length > 0;
    }
    if (section === "interests") {
      return extras.interests.length > 0;
    }
    return false;
  }, [basic.date_of_birth, basic.gender, basic.name, basic.preference, extras.bio, extras.interests.length, extras.photos.length, section]);

  const persistBasicDraft = (patch) => {
    const next = {
      ...basic,
      ...(patch || {}),
    };
    setBasic(next);
    saveProfileEditDraft(user?.id, next);
  };

  const updateExtras = (patch) => {
    const next = patchProfileExtras(user?.id, patch);
    setExtras(next);
  };

  const onSave = async () => {
    if (loading || !isKnownSection) {
      return;
    }
    setError("");
    setSuccess("");

    if (["name", "dob", "gender", "preferences"].includes(section)) {
      if (!basic.name || !basic.date_of_birth || !basic.gender || !basic.preference) {
        setError("Name, date of birth, gender and preference are required.");
        return;
      }
      if (!isAdultDob(basic.date_of_birth)) {
        setError("You must be 18+ to use this app.");
        return;
      }
    }

    if (section === "photos" && extras.photos.length < 1) {
      setError("Add at least one photo.");
      return;
    }

    setLoading(true);
    try {
      if (["name", "dob", "gender", "preferences"].includes(section)) {
        await saveBasicProfile({
          name: basic.name.trim(),
          date_of_birth: basic.date_of_birth,
          gender: basic.gender,
          preference: basic.preference,
        });
        await fetchCurrentUser();
        clearProfileEditDraft(user?.id);
      } else if (["bio", "interests"].includes(section)) {
        await saveProfileExtras({
          bio: extras.bio,
          interests: extras.interests,
        });
        await fetchCurrentUser();
        updateExtras({
          bio: extras.bio,
          interests: extras.interests,
          photos: extras.photos,
        });
      } else {
        updateExtras({
          bio: extras.bio,
          interests: extras.interests,
          photos: extras.photos,
        });
      }

      setSuccess("Saved");
      navigate("/profile/edit");
    } catch (apiError) {
      setError(apiError?.message || "Could not save changes.");
    } finally {
      setLoading(false);
    }
  };

  const onPhotoSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const remainingSlots = Math.max(0, MAX_PHOTOS - extras.photos.length);
      const uploadFiles = files.slice(0, remainingSlots);
      if (!uploadFiles.length) {
        setError(`You can upload up to ${MAX_PHOTOS} photos.`);
        return;
      }

      const merged = [...extras.photos];
      for (const file of uploadFiles) {
        const created = await uploadProfilePhoto(file);
        merged.push({
          id: created.id,
          src: created.image_url,
        });
      }
      updateExtras({ photos: merged });
    } catch (apiError) {
      setError(apiError?.message || "Could not upload one or more photos.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const removePhoto = async (photoId) => {
    setLoading(true);
    setError("");
    try {
      await deleteProfilePhoto(photoId);
      updateExtras({
        photos: extras.photos.filter((item) => item.id !== photoId),
      });
    } catch (apiError) {
      setError(apiError?.message || "Could not delete photo.");
    } finally {
      setLoading(false);
    }
  };

  const movePhoto = async (index, direction) => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= extras.photos.length) {
      return;
    }
    const source = extras.photos[index];
    const target = extras.photos[targetIndex];
    let next = updateItemAtIndex(extras.photos, index, target);
    next = updateItemAtIndex(next, targetIndex, source);
    setLoading(true);
    setError("");
    try {
      const orderedIds = next.map((item) => Number(item.id));
      const reordered = await reorderProfilePhotos(orderedIds);
      updateExtras({
        photos: reordered.map((photo) => ({
          id: photo.id,
          src: photo.image_url,
        })),
      });
    } catch (apiError) {
      setError(apiError?.message || "Could not reorder photos.");
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest) => {
    const exists = extras.interests.includes(interest);
    updateExtras({
      interests: exists
        ? extras.interests.filter((item) => item !== interest)
        : [...extras.interests, interest],
    });
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-5">
      <header className="mb-4 flex items-center justify-between">
        <Button fullWidth={false} onClick={() => navigate("/profile/edit")} variant="ghost">
          Back
        </Button>
        <p className="text-xs text-slate-300">Step {stepLabel}</p>
      </header>

      <section className="rounded-2xl border border-white/15 bg-slate-900/65 p-4 shadow-xl shadow-black/20">
        <h1 className="text-xl font-semibold text-white">{sectionMeta.title}</h1>
        <p className="mt-1 text-xs text-slate-300">{sectionMeta.subtitle}</p>

        <div className="mt-4 space-y-4">
          {section === "name" ? (
            <Input
              id="edit-name"
              label="Name"
              onChange={(event) => persistBasicDraft({ name: event.target.value })}
              placeholder="Enter your name"
              value={basic.name}
            />
          ) : null}

          {section === "dob" ? (
            <>
              <Input
                id="edit-dob"
                label="Date of Birth"
                onChange={(event) => persistBasicDraft({ date_of_birth: event.target.value })}
                type="date"
                value={basic.date_of_birth}
              />
              <p className="text-xs text-slate-300">You must be 18+ to use this app.</p>
            </>
          ) : null}

          {section === "gender" ? (
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ].map((item) => (
                <button
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
                    basic.gender === item.value
                      ? "border-cyan-300/60 bg-cyan-400/20 text-white"
                      : "border-white/20 bg-white/5 text-slate-100"
                  }`}
                  key={item.value}
                  onClick={() => persistBasicDraft({ gender: item.value })}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {section === "preferences" ? (
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: "male", label: "Men" },
                { value: "female", label: "Women" },
                { value: "everyone", label: "Everyone" },
              ].map((item) => (
                <button
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
                    basic.preference === item.value
                      ? "border-rose-300/60 bg-rose-400/20 text-white"
                      : "border-white/20 bg-white/5 text-slate-100"
                  }`}
                  key={item.value}
                  onClick={() => persistBasicDraft({ preference: item.value })}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {section === "photos" ? (
            <>
              <label className="block cursor-pointer rounded-xl border border-dashed border-white/35 bg-white/5 px-4 py-3 text-center text-sm text-slate-100 hover:bg-white/10">
                + Add Photos
                <input accept="image/*" className="hidden" multiple onChange={onPhotoSelect} type="file" />
              </label>
              <p className="text-xs text-slate-300">Profiles with more photos get more matches.</p>
              <div className="space-y-2">
                {extras.photos.map((photo, index) => (
                  <div
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-2"
                    key={photo.id}
                  >
                    <img alt="Profile upload" className="h-16 w-16 rounded-lg object-cover" src={photo.src} />
                    <div className="ml-auto flex gap-1">
                      <button
                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-slate-100"
                        disabled={index === 0}
                        onClick={() => movePhoto(index, "left")}
                        type="button"
                      >
                        ←
                      </button>
                      <button
                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-slate-100"
                        disabled={index === extras.photos.length - 1}
                        onClick={() => movePhoto(index, "right")}
                        type="button"
                      >
                        →
                      </button>
                      <button
                        className="rounded-md border border-rose-300/30 px-2 py-1 text-xs text-rose-200"
                        onClick={() => removePhoto(photo.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {section === "bio" ? (
            <textarea
              className="min-h-[140px] w-full rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-400 focus:border-rose-300/60 focus:outline-none"
              onChange={(event) => updateExtras({ bio: event.target.value })}
              placeholder="Tell people about your vibe..."
              value={extras.bio}
            />
          ) : null}

          {section === "interests" ? (
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const selected = extras.interests.includes(interest);
                return (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-cyan-300/60 bg-cyan-400/20 text-white"
                        : "border-white/20 bg-white/5 text-slate-200 hover:border-white/35"
                    }`}
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    type="button"
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">
            {success}
          </p>
        ) : null}

        <div className="mt-5">
          <Button disabled={!canSave || loading} loading={loading} onClick={onSave}>
            Save Changes
          </Button>
        </div>
      </section>
    </main>
  );
}
