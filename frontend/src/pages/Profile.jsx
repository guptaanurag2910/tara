import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crown, Edit3, Eye, Heart, Settings, Sparkles } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { fetchProfilePhotos } from "../services/onboardingService";
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

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl glass px-2 py-3 text-center">
      <p className="font-[var(--font-serif)] text-3xl text-[color:var(--tara-text-primary)]">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--tara-text-faint)]">{label}</p>
    </div>
  );
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
  }, [user?.id]);

  const age = ageFromDob(user?.date_of_birth);
  const displayName = user?.name || "Your profile";
  const title = age ? `${displayName}, ${age}` : displayName;
  const profileMeta = useMemo(() => {
    const chunks = [];
    if (user?.gender) {
      chunks.push(String(user.gender).replace(/_/g, " "));
    }
    if (user?.moon_sign) {
      chunks.push(`${String(user.moon_sign).replace(/_/g, " ")} moon`);
    }
    return chunks.length > 0 ? chunks.join(" · ") : "Scorpio · Pisces moon";
  }, [user?.gender, user?.moon_sign]);

  const personalityText =
    Array.isArray(extras?.interests) && extras.interests.length > 0
      ? extras.interests.slice(0, 3).join(" · ")
      : "Intuitive · Romantic · Curious";

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
          <Stat label="Matches" value="42" />
          <Stat label="Likes" value="218" />
          <Stat label="Views" value="1.2k" />
        </div>
      </div>

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
          <Row
            icon={<Heart className="h-4 w-4 text-[color:var(--tara-gold)]" />}
            label="Looking for"
            value={`Long-term · ${preferenceLabel(user?.preference)}`}
            to="/profile/edit/preferences"
          />
          <Row icon={<Eye className="h-4 w-4 text-[color:var(--tara-gold)]" />} label="Visibility" value="Visible to all" to="/settings" />
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
              navigate("/", { replace: true });
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
