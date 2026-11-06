import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { applyAppearanceMode, getUserSettings, patchUserSettings } from "../services/settingsService";
import { fetchNotificationPreferences, saveNotificationPreferences } from "../services/notificationService";
import { deleteAccount, downloadAccountData, fetchMyModerationActions, fetchPrivacySettings, savePrivacySettings, submitModerationAppeal } from "../services/privacyService";

function SectionCard({ title, children }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-section-content">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, ariaLabel }) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={`settings-toggle ${checked ? "is-on" : ""}`}
      onClick={onChange}
      type="button"
    >
      <span />
    </button>
  );
}

function Row({ label, hint, right }) {
  return (
    <div className="settings-row">
      <div>
        <strong>{label}</strong>
        {hint ? <p>{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export default function Settings() {
  const router = useNavigate();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(() => getUserSettings(user?.id));
  const [notificationError, setNotificationError] = useState("");
  const [privacy, setPrivacy] = useState({ profile_visible: true, show_age: true, show_interests: true, show_astrology: true });
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [moderationActions, setModerationActions] = useState([]);
  const [appealStatements, setAppealStatements] = useState({});

  useEffect(() => {
    setSettings(getUserSettings(user?.id));
    if (user?.id) {
      fetchNotificationPreferences().then((preferences) => {
        setSettings((current) => patchUserSettings(user.id, { notifications: preferences }));
      }).catch(() => setNotificationError("Notification preferences could not be loaded."));
      fetchPrivacySettings().then(setPrivacy).catch(() => setAccountError("Privacy settings could not be loaded."));
      fetchMyModerationActions().then(setModerationActions).catch(() => {});
    }
  }, [user?.id]);

  const updateSettings = (patch) => {
    const next = patchUserSettings(user?.id, patch);
    setSettings(next);
  };

  const updateNotificationPreference = async (key) => {
    const value = !settings.notifications[key];
    const next = patchUserSettings(user?.id, { notifications: { ...settings.notifications, [key]: value } });
    setSettings(next);
    setNotificationError("");
    try {
      const saved = await saveNotificationPreferences({ [key]: value });
      setSettings((current) => patchUserSettings(user?.id, { notifications: { ...current.notifications, ...saved } }));
    } catch {
      setSettings((current) => patchUserSettings(user?.id, { notifications: { ...current.notifications, [key]: !value } }));
      setNotificationError("Could not save this notification preference.");
    }
  };

  const updatePrivacy = async (key) => {
    const nextValue = !privacy[key];
    const previous = privacy[key];
    setPrivacy((current) => ({ ...current, [key]: nextValue }));
    setAccountError("");
    try {
      setPrivacy(await savePrivacySettings({ [key]: nextValue }));
    } catch (error) {
      setPrivacy((current) => ({ ...current, [key]: previous }));
      setAccountError(error?.message || "Could not save this privacy setting.");
    }
  };

  const exportAccountData = async () => {
    setAccountBusy(true);
    setAccountError("");
    try { await downloadAccountData(); }
    catch (error) { setAccountError(error?.message || "Could not prepare your data download."); }
    finally { setAccountBusy(false); }
  };

  const removeAccount = async () => {
    if (!window.confirm("Permanently delete your Tara account and profile data? Safety reports already submitted may be retained to protect users. This cannot be undone.")) return;
    setAccountBusy(true);
    setAccountError("");
    try {
      await deleteAccount();
      await logout();
      window.location.replace("/");
    } catch (error) {
      setAccountError(error?.message || "Could not delete your account. Please try again.");
      setAccountBusy(false);
    }
  };

  const sendAppeal = async (actionId) => {
    const statement = String(appealStatements[actionId] || "").trim();
    if (!statement) { setAccountError("Add a short explanation for your appeal."); return; }
    setAccountBusy(true); setAccountError("");
    try { await submitModerationAppeal(actionId, statement); setModerationActions(await fetchMyModerationActions()); setAppealStatements((current) => ({ ...current, [actionId]: "" })); }
    catch (error) { setAccountError(error?.message || "Could not send your appeal."); }
    finally { setAccountBusy(false); }
  };

  return (
    <main className="tara-settings tara-container">
      <header className="settings-header">
        <div className="settings-brand">tara<span>.</span></div>
        <Button fullWidth={false} onClick={() => router({ to: "/profile" })} variant="ghost">
          Back
        </Button>
        <p className="settings-eyebrow">YOUR ACCOUNT</p>
        <h1>Settings</h1>
        <p>Manage preferences, privacy and account.</p>
      </header>

      <div className="settings-sections">
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
            hint="Get notified when you make a new connection"
            label="New Connections"
            right={
              <Toggle
                ariaLabel="Toggle new matches notifications"
                checked={settings.notifications.matches}
                onChange={() =>
                  updateNotificationPreference("matches")
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
                  updateNotificationPreference("messages")
                }
              />
            }
          />
          <Row
            hint="A prompt when it’s your turn in a chat game"
            label="Game Turns"
            right={
              <Toggle
                ariaLabel="Toggle game turn notifications"
                checked={settings.notifications.game_turns}
                onChange={() =>
                  updateNotificationPreference("game_turns")
                }
              />
            }
          />
          {notificationError ? <p className="text-xs text-rose-300" role="status">{notificationError}</p> : null}
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
                checked={privacy.profile_visible}
                onChange={() => updatePrivacy("profile_visible")}
              />
            }
          />
          <Row hint="Show your age without exposing your date of birth" label="Show Age" right={<Toggle ariaLabel="Toggle age visibility" checked={privacy.show_age} onChange={() => updatePrivacy("show_age")} />} />
          <Row hint="Show your interests on your profile" label="Show Interests" right={<Toggle ariaLabel="Toggle interests visibility" checked={privacy.show_interests} onChange={() => updatePrivacy("show_interests")} />} />
          <Row hint="Show astrology details and compatibility context" label="Show Astrology" right={<Toggle ariaLabel="Toggle astrology visibility" checked={privacy.show_astrology} onChange={() => updatePrivacy("show_astrology")} />} />
          <p className="px-1 py-3 text-xs text-[#737373]">Birth date, birth time, birth place, and exact coordinates stay private. Tara uses them for astrology calculations and does not show them on discovery profiles.</p>
        </SectionCard>

        {moderationActions.length ? <SectionCard title="Restrictions and appeals">
          {moderationActions.map((action) => <article className="border-b border-[#eee] py-3 last:border-0" key={action.id}><p className="text-sm font-semibold capitalize text-[#262626]">{action.action_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#737373]">Reason: {action.reason_code}{action.expires_at ? ` · Until ${new Date(action.expires_at).toLocaleString()}` : ""}</p>{action.appeal_status ? <p className="mt-2 text-xs font-semibold capitalize text-[#555]">Appeal status: {action.appeal_status.replaceAll("_", " ")}</p> : <><textarea aria-label={`Appeal action ${action.id}`} className="mt-2 min-h-16 w-full rounded-lg border border-[#dedede] px-3 py-2 text-sm" maxLength={2000} onChange={(event) => setAppealStatements((current) => ({ ...current, [action.id]: event.target.value }))} placeholder="Tell us why you think this decision should be reviewed." value={appealStatements[action.id] || ""} /><button className="mt-2 rounded-lg bg-[#262626] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={accountBusy} onClick={() => sendAppeal(action.id)} type="button">Submit appeal</button></>}</article>)}
        </SectionCard> : null}

        <SectionCard title="Account">
          <p className="settings-account-note">Download a copy of your Tara data or permanently delete your account and profile data.</p>
          {accountError ? <p role="alert" className="text-sm text-rose-600">{accountError}</p> : null}
          <div className="flex flex-wrap gap-2 py-3">
            <Button disabled={accountBusy} onClick={exportAccountData} variant="ghost">{accountBusy ? "Please wait…" : "Download my data"}</Button>
            <Button disabled={accountBusy} onClick={removeAccount} variant="ghost">Delete account</Button>
          </div>
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
