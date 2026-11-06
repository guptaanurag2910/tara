import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Edit3, Settings } from "lucide-react";

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
    <div className="profile-stat" data-testid={testId}>
      <p data-testid={testId ? `${testId}-value` : undefined}>
        {value}
      </p>
      <span>{label}</span>
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

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [extras, setExtras] = useState(() => getProfileExtras(user?.id));
  const [profileSummary, setProfileSummary] = useState(null);
  const [stats, setStats] = useState({
    matchesCount: 0,
    likesReceivedCount: 0,
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
  const personalityText = topTraitText(traits);
  const interestText = Array.isArray(extras?.interests) ? extras.interests.join(" · ") : "";
  const bioText = String(extras?.bio || "").trim();
  const preference = basicInfo?.preference || user?.preference;
  const gender = basicInfo?.gender || user?.gender;
  const birthPlaceText = shortPlaceLabel(birthDetails?.birth_place || user?.birth_place);
  const avatarSrc = extras?.photos?.[0]?.src || user?.photo || "";
  const photos = Array.isArray(extras?.photos) ? extras.photos : [];
  const facts = [
    interestText ? { label: "Interests", value: interestText } : null,
    preference ? { label: "Looking for", value: preferenceLabel(preference) } : null,
    gender ? { label: "Gender", value: sentenceCase(gender) } : null,
    personalityText ? { label: "Personality", value: personalityText } : null,
  ].filter(Boolean);

  return (
    <main className="tara-profile tara-container">
      <header className="profile-page-header">
        <div className="profile-brand">tara<span>.</span></div>
        <h1 className="sr-only">Profile</h1>
      </header>

      <section className="profile-overview">
        <div className="profile-intro">
          <div className="profile-avatar">
            {avatarSrc ? <img src={avatarSrc} alt={displayName} /> : <span>{initials(displayName)}</span>}
          </div>
          <div className="profile-identity">
            <h2>{title}</h2>
            {birthPlaceText ? <p>Born in {birthPlaceText}</p> : null}
          </div>
          <Link to="/settings" aria-label="Settings" className="profile-settings-link"><Settings size={19} /></Link>
        </div>
        <div className="profile-stats">
          <Stat label="Matches" value={profileSummary ? formatMetric(stats.matchesCount) : "—"} testId="profile-stat-matches" />
          <Stat label="Likes" value={profileSummary ? formatMetric(stats.likesReceivedCount) : "—"} testId="profile-stat-likes" />
        </div>
        <button className="profile-edit-button" onClick={() => navigate("/profile/edit")} type="button"><Edit3 size={15} /> Edit profile</button>
      </section>

      <section className="profile-vibe-card">
        <div>
          <span>PERSONALITY</span>
          <h2>{personalityText || "Get to know your vibe"}</h2>
          <p>{personalityText ? "See the patterns behind your answers." : "Take the optional test when you're ready."}</p>
        </div>
        <Link to="/your-vibe">{personalityText ? "View Your Vibe" : "Explore Your Vibe"}</Link>
      </section>

      <section className="profile-section profile-about">
        <div className="profile-section-heading">
          <h2>About</h2>
        </div>
        {bioText ? <p className="profile-bio-card" data-testid="profile-bio-card">{bioText}</p> : <Link className="profile-add-bio" data-testid="profile-add-bio" to="/profile/edit/bio">Add a bio</Link>}
        {facts.length > 0 ? (
          <dl className="profile-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section className="profile-section profile-photos">
        <div className="profile-section-heading">
          <h2>Photos</h2>
          {photos.length > 0 ? <Link to="/profile/edit/photos">Manage</Link> : null}
        </div>
        {photos.length > 0 ? (
          <div className="profile-photo-grid" data-testid="profile-photo-grid">
            {photos.map((photo, index) => (
              <div key={photo.id || photo.src || index}>
                <img src={photo.src} alt={`${displayName} photo ${index + 1}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="profile-photo-empty" data-testid="profile-photo-empty">
            <span>No photos yet</span>
            <Link to="/profile/edit/photos">Add photos</Link>
          </div>
        )}
      </section>
    </main>
  );
}
