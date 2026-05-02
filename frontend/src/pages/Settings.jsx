import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { getUserSettings, patchUserSettings } from "../services/settingsService";

function SectionCard({ title, children }) {
  return (
    <section className="tara-screen-panel p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--tara-text-secondary)]">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, ariaLabel }) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={`relative h-7 w-12 rounded-full border transition ${
        checked
          ? "border-[color:var(--tara-color-success)]/35 bg-[color:var(--tara-color-success-soft)]"
          : "border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)]"
      }`}
      onClick={onChange}
      type="button"
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-[color:var(--tara-card-bg-strong)] shadow-sm transition ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

function Row({ label, hint, right }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--tara-card-border)] bg-[color:var(--tara-surface-soft)] px-3 py-2.5">
      <div>
        <p className="text-sm text-[color:var(--tara-text-primary)]">{label}</p>
        {hint ? <p className="text-xs text-[color:var(--tara-text-secondary)]">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { appearanceMode, resolvedTheme, setAppearanceMode } = useTheme();
  const [settings, setSettings] = useState(() => getUserSettings(user?.id));

  useEffect(() => {
    setSettings(getUserSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    setSettings((current) => ({
      ...current,
      appearance: appearanceMode,
    }));
  }, [appearanceMode]);

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
    <main className="tara-page-shell-compact px-4 py-5">
      <header className="tara-screen-panel mb-4 flex items-center justify-between px-4 py-4">
        <div>
          <p className="tara-kicker">Least decorative, most useful</p>
          <h1 className="tara-type-section mt-2 text-[2rem] leading-none">Settings</h1>
          <p className="text-xs text-[color:var(--tara-text-secondary)]">Manage preferences, privacy and account</p>
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
                className="w-16 rounded-lg border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg)_82%,transparent)] px-2 py-1 text-right text-sm text-[color:var(--tara-text-primary)]"
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
                className="w-16 rounded-lg border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg)_82%,transparent)] px-2 py-1 text-right text-sm text-[color:var(--tara-text-primary)]"
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
            right={<span className="text-sm text-[color:var(--tara-text-primary)]">{settings.discovery.distanceKm} km</span>}
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
            <span className="mb-1.5 block font-medium text-[color:var(--tara-text-primary)]">Gender Preference</span>
            <select
              aria-label="Gender preference"
              className="w-full rounded-xl border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg)_82%,transparent)] px-3 py-3 text-sm text-[color:var(--tara-text-primary)]"
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
          <p className="text-xs text-[color:var(--tara-text-secondary)]">
            Follow your device or keep Tara in a saved day or night mood. Right now you&apos;re seeing{" "}
            <span className="font-medium text-[color:var(--tara-text-primary)]">{resolvedTheme === "dark" ? "Night" : "Day"}</span>.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "light", label: "Day" },
              { value: "dark", label: "Night" },
              { value: "system", label: "System" },
            ].map((item) => (
              <button
                className={`tara-motion-pressable rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  appearanceMode === item.value
                    ? "border-[color:var(--tara-card-active-border)] bg-[color:color-mix(in_srgb,var(--tara-violet)_18%,transparent)] text-[color:var(--tara-text-primary)] shadow-[0_0_20px_rgba(111,99,247,0.1)]"
                    : "border-[color:var(--tara-card-border)] bg-[color:var(--tara-surface-soft)] text-[color:var(--tara-text-primary)]"
                }`}
                key={item.value}
                onClick={() => {
                  setSettings((current) => ({ ...current, appearance: item.value }));
                  setAppearanceMode(item.value);
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
            className="w-full rounded-xl border border-[color:var(--tara-color-destructive)]/35 bg-[color:var(--tara-color-destructive-soft)] px-3 py-3 text-left text-sm font-medium text-[color:var(--tara-text-primary)]"
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
