import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crown, Edit3, Eye, Heart, Settings, Sparkles } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { fetchProfilePhotos, fetchProfileSummary } from "../services/onboardingService";
import { ageFromDob, getProfileExtras, hydrateProfileExtrasFromOnboarding } from "../services/profileService";

function initials(name) {
  if (!name) {
    return "T";
  }
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "T";
}

function preferenceLabel(preference) {
  if (preference === "male") {
    return "Men";
  }
  if (preference === "female") {
    return "Women";
  }
  if (preference === "everyone") {
    return "Everyone";
  }
  return "Meaningful";
}

function sentenceCase(value) {
  if (!value) {
    return "";
  }
  const normalized = String(value).replace(/_/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function shortPlaceLabel(place) {
  const parts = String(place || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] || "";
}

const TRAIT_LABELS = {
  chaos: "Spontaneous",
  communication: "Communicative",
  emotional_depth: "Emotionally deep",
  openness: "Open-minded",
  overthinking: "Thoughtful",
  stability: "Grounded",
};

function topTraitText(traits) {
  const ranked = Object.entries(traits || {})
    .map(([key, score]) => [key, Number(score || 0)])
    .filter(([, score]) => Number.isFinite(score) && score > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([key]) => TRAIT_LABELS[key] || sentenceCase(key));

  return ranked.join(" · ");
}

function Stat({ label, value, testId }) {
  return (
    <div className="rounded-2xl glass px-2 py-3 text-center" data-testid={testId}>
      <p className="font-[var(--font-serif)] text-3xl text-[color:var(--tara-text-primary)]" data-testid={testId ? `${testId}-value` : undefined}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--tara-text-faint)]">{label}</p>
    </div>
  );
}

function formatMetric(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  if (numeric >= 1000) {
    const compact = numeric / 1000;
    return `${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)}k`;
  }
  return String(numeric);
}

function Row({ icon, label, value, to, onClick }) {
  const content = (
    <>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--tara-violet)]/20">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-[color:var(--tara-text-secondary)]">{label}</p>
        <p className="text-sm font-medium text-[color:var(--tara-text-primary)]">{value}</p>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="flex items-center gap-3 rounded-2xl glass px-4 py-3">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl glass px-4 py-3 text-left">
      {content}
    </button>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [extras, setExtras] = useState(() => getProfileExtras(user?.id));
  const [profileSummary, setProfileSummary] = useState(null);
  const [stats, setStats] = useState({
    matchesCount: 0,
    likesReceivedCount: 0,
    profileImpressionsCount: 0,
  });

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const hydrated = hydrateProfileExtrasFromOnboarding(user.id);
    const backendInterests = Array.isArray(user?.interests) ? user.interests : [];
    setExtras({
      ...hydrated,
      bio: hydrated.bio || user?.bio || "",
      interests: hydrated.interests.length > 0 ? hydrated.interests : backendInterests,
    });

    fetchProfilePhotos()
      .then((photos) => {
        if (!Array.isArray(photos)) {
          return;
        }
        setExtras((prev) => ({
          ...prev,
          photos: photos.map((photo) => ({ id: photo.id, src: photo.image_url })),
        }));
      })
      .catch(() => {
        // Keep profile available even if photo request fails.
      });

    fetchProfileSummary()
      .then((summary) => {
        setProfileSummary(summary || null);
        const nextStats = summary?.stats || {};
        const summaryExtras = summary?.profile_extras || {};
        const summaryPhotos = Array.isArray(summary?.photos)
          ? summary.photos
              .filter((photo) => photo?.image_url)
              .map((photo) => ({ id: photo.id, src: photo.image_url }))
          : null;
        setStats({
          matchesCount: Number(nextStats.matches_count || 0),
          likesReceivedCount: Number(nextStats.likes_received_count || 0),
          profileImpressionsCount: Number(nextStats.profile_impressions_count || 0),
        });
        setExtras((prev) => ({
          ...prev,
          bio:
            typeof summaryExtras.bio === "string"
              ? summaryExtras.bio
              : prev.bio || user?.bio || "",
          interests:
            Array.isArray(summaryExtras.interests) && summaryExtras.interests.length > 0
              ? summaryExtras.interests
              : prev.interests,
          photos: summaryPhotos ?? prev.photos,
        }));
      })
      .catch(() => {
        // Keep profile usable even if stats fail to load.
      });
  }, [user?.id]);

  const basicInfo = profileSummary?.basic_info || {};
  const birthDetails = profileSummary?.birth_details || {};
  const traits = profileSummary?.traits || {};
  const age = ageFromDob(basicInfo?.date_of_birth || user?.date_of_birth);
  const displayName = basicInfo?.name || user?.name || "Your profile";
  const title = age ? `${displayName}, ${age}` : displayName;
  const profileMeta = useMemo(() => {
    const chunks = [];
    const gender = basicInfo?.gender || user?.gender;
    const preference = basicInfo?.preference || user?.preference;
    const birthPlace = birthDetails?.birth_place || user?.birth_place;

    if (gender) {
      chunks.push(sentenceCase(gender));
    }
    if (preference) {
      chunks.push(`Looking for ${preferenceLabel(preference)}`);
    }
    if (birthPlace) {
      chunks.push(`Born in ${shortPlaceLabel(birthPlace)}`);
    }
    return chunks.length > 0 ? chunks.join(" · ") : "Add a few details to bring your profile to life.";
  }, [basicInfo?.gender, basicInfo?.preference, birthDetails?.birth_place, user?.birth_place, user?.gender, user?.preference]);

  const personalityText = topTraitText(traits) || "Complete your vibe questions to see your core traits.";
  const interestText =
    Array.isArray(extras?.interests) && extras.interests.length > 0
      ? extras.interests.slice(0, 3).join(" · ")
      : "Add a few interests so matches can get a feel for you.";
  const bioText = String(extras?.bio || "").trim();
  const preferenceText = basicInfo?.preference
    ? `Open to ${preferenceLabel(basicInfo.preference)}`
    : user?.preference
      ? `Open to ${preferenceLabel(user.preference)}`
      : "Set who you’d like to meet.";
  const birthPlaceText = shortPlaceLabel(birthDetails?.birth_place || user?.birth_place) || "Add your birth location.";
  const photoCountText = Array.isArray(extras?.photos) && extras.photos.length > 0 ? `${extras.photos.length} uploaded` : "Add your first photo";

  const avatarSrc = extras?.photos?.[0]?.src || user?.photo || "";

  return (
    <main className="tara-container px-5 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="tara-heading text-6xl">Profile</h1>
        <Link to="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-full glass">
          <Settings className="h-4 w-4" />
        </Link>
      </header>

      <div className="relative mt-6 overflow-hidden rounded-3xl bg-card-gradient p-6 shadow-card-mystic">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-glow blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[color:var(--tara-violet)] opacity-50 blur-md" />
            <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-[color:var(--tara-gold)]/60 ring-offset-2 ring-offset-[#090338]">
              {avatarSrc ? (
                <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-400/80 to-amber-300/70 text-2xl text-white">
                  {initials(displayName)}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="tara-heading text-4xl text-[color:var(--tara-text-primary)]">{title}</h2>
            <p className="text-xs text-[color:var(--tara-text-secondary)]">{profileMeta}</p>
            <button
              type="button"
              onClick={() => navigate("/profile/edit")}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-[color:var(--tara-violet)]/20 px-3 py-1 text-[11px] font-medium text-[color:var(--tara-text-primary)]"
            >
              <Edit3 className="h-3 w-3" /> Edit profile
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <Stat label="Matches" value={formatMetric(stats.matchesCount)} testId="profile-stat-matches" />
          <Stat label="Likes" value={formatMetric(stats.likesReceivedCount)} testId="profile-stat-likes" />
          <Stat label="Seen" value={formatMetric(stats.profileImpressionsCount)} testId="profile-stat-seen" />
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-text-faint)]">About me</h2>
          <Link to="/profile/edit/bio" className="text-xs font-medium text-[color:var(--tara-gold)]">
            Edit
          </Link>
        </div>
        <div className="rounded-3xl glass p-5" data-testid="profile-bio-card">
          <p className="text-sm leading-6 text-[color:var(--tara-text-primary)]">
            {bioText || "Add a short bio so people can understand your energy before they say hi."}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-text-faint)]">Photos</h2>
          <Link to="/profile/edit/photos" className="text-xs font-medium text-[color:var(--tara-gold)]">
            Manage
          </Link>
        </div>
        {Array.isArray(extras?.photos) && extras.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-3" data-testid="profile-photo-grid">
            {extras.photos.map((photo, index) => (
              <div key={photo.id || photo.src || index} className="overflow-hidden rounded-2xl glass">
                <img src={photo.src} alt={`${displayName} photo ${index + 1}`} className="h-28 w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl glass p-5 text-sm text-[color:var(--tara-text-secondary)]" data-testid="profile-photo-empty">
            No photos yet. Add a few so your profile feels real and welcoming.
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => navigate("/stars-today")}
        className="mt-4 flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-gold-gradient p-5 text-[#281d08] shadow-[0_0_30px_rgba(231,179,78,0.35)]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/15">
          <Crown className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-[var(--font-serif)] text-3xl leading-none">Tara Celestial</p>
          <p className="text-xs opacity-85">See who&apos;s already aligned with you.</p>
        </div>
        <Sparkles className="h-5 w-5" />
      </button>

      <section className="mt-6">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-[color:var(--tara-text-faint)]">Your vibe</h2>
        <div className="space-y-2">
          <Row icon={<Sparkles className="h-4 w-4 text-[color:var(--tara-gold)]" />} label="My personality" value={personalityText} to="/profile/edit/interests" />
          <Row icon={<Heart className="h-4 w-4 text-[color:var(--tara-gold)]" />} label="My interests" value={interestText} to="/profile/edit/interests" />
          <Row
            icon={<Heart className="h-4 w-4 text-[color:var(--tara-gold)]" />}
            label="Looking for"
            value={preferenceText}
            to="/profile/edit/preferences"
          />
          <Row icon={<Eye className="h-4 w-4 text-[color:var(--tara-gold)]" />} label="Birth location" value={birthPlaceText} to="/kundali" />
          <Row icon={<Edit3 className="h-4 w-4 text-[color:var(--tara-gold)]" />} label="Photos" value={photoCountText} to="/profile/edit/photos" />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-[color:var(--tara-text-faint)]">Account</h2>
        <div className="space-y-2">
          {["Notifications", "Privacy & safety", "Help & support"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => navigate("/settings")}
              className="flex w-full items-center justify-between rounded-2xl glass px-5 py-4 text-left text-sm text-[color:var(--tara-text-primary)]"
            >
              <span>{item}</span>
              <span className="text-[color:var(--tara-text-faint)]">›</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.replace("/");
            }}
            className="flex w-full items-center justify-between rounded-2xl border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-left text-sm text-rose-100"
          >
            <span>Sign out</span>
            <span className="opacity-60">›</span>
          </button>
        </div>
      </section>
    </main>
  );
}
