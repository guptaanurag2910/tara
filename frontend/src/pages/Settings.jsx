import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { applyAppearanceMode, getUserSettings, patchUserSettings } from "../services/settingsService";

function SectionCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/15 bg-slate-900/65 p-4 shadow-xl shadow-black/20">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, ariaLabel }) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={`relative h-7 w-12 rounded-full transition ${
        checked ? "bg-emerald-500/80" : "bg-white/20"
      }`}
      onClick={onChange}
      type="button"
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

function Row({ label, hint, right }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <div>
        <p className="text-sm text-white">{label}</p>
        {hint ? <p className="text-xs text-slate-300">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(() => getUserSettings(user?.id));

  useEffect(() => {
    setSettings(getUserSettings(user?.id));
  }, [user?.id]);

  const updateSettings = (patch) => {
    const next = patchUserSettings(user?.id, patch);
    setSettings(next);
  };

  const onDeleteAccount = () => {
    const confirmed = window.confirm(
      "Delete account is currently demo-only. We'll sign you out now. Continue?"
    );
    if (!confirmed) {
      return;
    }
    logout();
    window.location.replace("/");
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-xs text-slate-300">Manage preferences, privacy and account</p>
        </div>
        <Button fullWidth={false} onClick={() => navigate("/profile")} variant="ghost">
          Back
        </Button>
      </header>

      <div className="space-y-4 pb-20">
        <SectionCard title="Preferences">
          <Row
            hint="Minimum age in Discover"
            label="Min Age"
            right={
              <input
                aria-label="Minimum age"
                className="w-16 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-right text-sm text-white"
                min={18}
                onChange={(event) =>
                  updateSettings({
                    discovery: {
                      ...settings.discovery,
                      minAge: Number(event.target.value) || settings.discovery.minAge,
                    },
                  })
                }
                type="number"
                value={settings.discovery.minAge}
              />
            }
          />
          <Row
            hint="Maximum age in Discover"
            label="Max Age"
            right={
              <input
                aria-label="Maximum age"
                className="w-16 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-right text-sm text-white"
                min={settings.discovery.minAge}
                onChange={(event) =>
                  updateSettings({
                    discovery: {
                      ...settings.discovery,
                      maxAge: Number(event.target.value) || settings.discovery.maxAge,
                    },
                  })
                }
                type="number"
                value={settings.discovery.maxAge}
              />
            }
          />
          <Row
            hint="How far you want matches from"
            label="Distance"
            right={<span className="text-sm text-slate-100">{settings.discovery.distanceKm} km</span>}
          />
          <input
            aria-label="Discovery distance"
            className="w-full accent-cyan-400"
            max={500}
            min={1}
            onChange={(event) =>
              updateSettings({
                discovery: {
                  ...settings.discovery,
                  distanceKm: Number(event.target.value),
                },
              })
            }
            type="range"
            value={settings.discovery.distanceKm}
          />

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-200">Gender Preference</span>
            <select
              aria-label="Gender preference"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-white"
              onChange={(event) =>
                updateSettings({
                  discovery: {
                    ...settings.discovery,
                    genderPreference: event.target.value,
                  },
                })
              }
              value={settings.discovery.genderPreference}
            >
              <option className="text-slate-900" value="everyone">
                Everyone
              </option>
              <option className="text-slate-900" value="female">
                Women
              </option>
              <option className="text-slate-900" value="male">
                Men
              </option>
            </select>
          </label>
        </SectionCard>

        <SectionCard title="Notifications">
          <Row
            hint="Get notified when a mutual match happens"
            label="New Matches"
            right={
              <Toggle
                ariaLabel="Toggle new matches notifications"
                checked={settings.notifications.matches}
                onChange={() =>
                  updateSettings({
                    notifications: {
                      ...settings.notifications,
                      matches: !settings.notifications.matches,
                    },
                  })
                }
              />
            }
          />
          <Row
            hint="Chat message notifications"
            label="Messages"
            right={
              <Toggle
                ariaLabel="Toggle messages notifications"
                checked={settings.notifications.messages}
                onChange={() =>
                  updateSettings({
                    notifications: {
                      ...settings.notifications,
                      messages: !settings.notifications.messages,
                    },
                  })
                }
              />
            }
          />
          <Row
            hint="Someone liked you"
            label="Likes"
            right={
              <Toggle
                ariaLabel="Toggle likes notifications"
                checked={settings.notifications.likes}
                onChange={() =>
                  updateSettings({
                    notifications: {
                      ...settings.notifications,
                      likes: !settings.notifications.likes,
                    },
                  })
                }
              />
            }
          />
        </SectionCard>

        <SectionCard title="Appearance">
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ].map((item) => (
              <button
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  settings.appearance === item.value
                    ? "border-cyan-300/60 bg-cyan-400/20 text-white"
                    : "border-white/20 bg-white/5 text-slate-100"
                }`}
                key={item.value}
                onClick={() => {
                  updateSettings({ appearance: item.value });
                  applyAppearanceMode(item.value);
                }}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Privacy">
          <Row
            hint="If off, your profile won't be shown in discovery"
            label="Profile Visibility"
            right={
              <Toggle
                ariaLabel="Toggle profile visibility"
                checked={settings.privacy.profileVisible}
                onChange={() =>
                  updateSettings({
                    privacy: {
                      ...settings.privacy,
                      profileVisible: !settings.privacy.profileVisible,
                    },
                  })
                }
              />
            }
          />
        </SectionCard>

        <SectionCard title="Account">
          <button
            className="w-full rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-3 text-left text-sm font-medium text-rose-100"
            onClick={onDeleteAccount}
            type="button"
          >
            Delete Account
          </button>
        </SectionCard>

        <div className="pt-2">
          <Button
            onClick={() => {
              logout();
              window.location.replace("/");
            }}
            variant="ghost"
          >
            Logout
          </Button>
        </div>
      </div>
    </main>
  );
}
