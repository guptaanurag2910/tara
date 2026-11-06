import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, ChevronLeft, ChevronRight,
  CircleUserRound, ClipboardList, Gamepad2, Heart, LayoutDashboard, LogOut, MessageCircle,
  Search, ShieldAlert, ShieldCheck, Sparkles, Users, X,
} from "lucide-react";

import {
  adminLogin, clearAdminToken, getAdminConversations, getAdminGames, getAdminMatches,
  getAdminOverview, getAdminRecommendations, getAdminSwipes, getAdminToken, getAdminUsers,
  getAdminRecommendationDetail,
  getAdminGameNightWindows, createAdminGameNightWindow, updateAdminGameNightWindow, deleteAdminGameNightWindow,
  getAdminSafetyReports, actOnAdminSafetyReport,
  getAdminSafetyAppeals, reviewAdminSafetyAppeal,
} from "../services/adminApi";
import RecommendationDetailPanel from "../components/RecommendationDetailPanel";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "recommendations", label: "Recommendations", icon: Sparkles },
  { id: "matches", label: "Matches", icon: Heart },
  { id: "swipes", label: "Swipes", icon: ArrowUpRight },
  { id: "conversations", label: "Conversations", icon: MessageCircle },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "game-night", label: "Game Night", icon: Sparkles },
  { id: "safety", label: "Safety reports", icon: ShieldAlert },
  { id: "appeals", label: "Appeals", icon: ShieldCheck },
];

const sectionCopy = {
  users: ["User directory", "Search and review member profiles and activity."],
  recommendations: ["Recommendations", "Review generated user-to-user recommendations and scores."],
  matches: ["Matches", "Review compatibility scores and connection status."],
  swipes: ["Swipes", "Review likes and passes and see which decisions became mutual matches."],
  conversations: ["Conversations", "Review message activity across matched users."],
  games: ["Game sessions", "See which conversation games members are playing."],
  "game-night": ["Game Night schedule", "Set the days, times, and timezone for live game rooms."],
  safety: ["Safety reports", "Review reports, preserve context, and record moderation decisions."],
  appeals: ["Safety appeals", "Review account restrictions and record a reasoned decision."],
};

function SafetyQueue({ reports, onChange }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function act(report, actionType) {
    const confirmText = actionType === "ban" ? "Permanently ban this account?" : actionType === "suspension" ? "Suspend this account?" : `Apply ${actionType} to this account?`;
    if (!window.confirm(confirmText)) return;
    setBusyId(report.id); setError(""); setNotice("");
    try {
      const payload = { action_type: actionType, reason_code: `report_${report.category}`, notes: "Action recorded from the safety moderation queue." };
      if (actionType === "restriction") { payload.expires_at = new Date(Date.now() + 7 * 86400000).toISOString(); payload.scope = "messaging"; }
      await actOnAdminSafetyReport(report.id, payload);
      setNotice(`Report #${report.id} updated.`); onChange();
    } catch (err) { setError(err.response?.data?.detail || "Could not apply this moderation action."); }
    finally { setBusyId(null); }
  }
  return <div className="space-y-4">{error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}{notice ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}
    {!reports?.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No open safety reports.</p> : reports.map((report) => <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-rose-700">{report.priority} · {report.category.replaceAll("_", " ")}</p><h3 className="mt-1 text-lg font-bold text-slate-900">Report #{report.id} · {report.target_type.replaceAll("_", " ")}</h3><p className="mt-1 text-xs text-slate-500">Reported user #{report.reported_user_id || "deleted"} · Reporter #{report.reporter_id || "deleted"} · {formatDateTime(report.created_at)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-800">{report.status.replaceAll("_", " ")}</span></div>{report.details ? <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{report.details}</p> : null}<details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-violet-700">View preserved evidence</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(report.evidence, null, 2)}</pre></details><div className="mt-4 flex flex-wrap gap-2">{["warning", "restriction", "suspension", "ban"].map((type) => <button key={type} disabled={busyId === report.id} onClick={() => act(report, type)} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize disabled:opacity-50 ${type === "ban" || type === "suspension" ? "bg-rose-700 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`} type="button">{busyId === report.id ? "Saving…" : type === "restriction" ? "Restrict 7 days" : type}</button>)}</div></article>)}
  </div>;
}

function SafetyAppealsQueue({ appeals, onChange }) {
  const [outcomes, setOutcomes] = useState({}); const [busyId, setBusyId] = useState(null); const [error, setError] = useState("");
  async function decide(appeal, status) {
    const outcome_note = String(outcomes[appeal.id] || "").trim();
    if (!outcome_note) { setError("Add the reason for the appeal decision first."); return; }
    setBusyId(appeal.id); setError("");
    try { await reviewAdminSafetyAppeal(appeal.id, { status, outcome_note }); onChange(); }
    catch (err) { setError(err.response?.data?.detail || "Could not save the appeal decision."); }
    finally { setBusyId(null); }
  }
  return <div className="space-y-4">{error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}{!appeals?.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No open appeals.</p> : appeals.map((appeal) => <article key={appeal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Appeal #{appeal.id} · {appeal.action_type}</p><h3 className="mt-1 text-lg font-bold">Account #{appeal.subject_user_id || "deleted"}</h3><p className="mt-1 text-xs text-slate-500">Reason {appeal.reason_code} · Report #{appeal.report_id || "—"} · {formatDateTime(appeal.created_at)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-800">{appeal.status.replaceAll("_", " ")}</span></div><p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{appeal.statement}</p><textarea aria-label={`Decision reason for appeal ${appeal.id}`} className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" maxLength={1000} onChange={(event) => setOutcomes((current) => ({ ...current, [appeal.id]: event.target.value }))} placeholder="Document why this appeal is upheld or overturned." value={outcomes[appeal.id] || ""} /><div className="mt-3 flex flex-wrap gap-2"><button disabled={busyId === appeal.id} onClick={() => decide(appeal, "upheld")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50" type="button">Uphold action</button><button disabled={busyId === appeal.id} onClick={() => decide(appeal, "overturned")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" type="button">Overturn and reinstate if eligible</button></div></article>)}</div>;
}

const emptyGameNightWindow = { weekday: 2, start_time: "19:00", end_time: "22:00", timezone_name: "Asia/Kolkata", is_enabled: true };
const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function GameNightAdminPanel({ windows, onChange }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyGameNightWindow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function edit(windowItem) {
    setEditing(windowItem?.id ?? "new");
    setForm(windowItem ? { ...windowItem, start_time: windowItem.start_time.slice(0, 5), end_time: windowItem.end_time.slice(0, 5) } : emptyGameNightWindow);
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing === "new") await createAdminGameNightWindow(form);
      else await updateAdminGameNightWindow(editing, form);
      setEditing(null);
      onChange();
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || JSON.stringify(err.response?.data) || "Could not save the window.");
    } finally { setSaving(false); }
  }

  async function remove(id) {
    if (!window.confirm("Delete this Game Night window?")) return;
    try { await deleteAdminGameNightWindow(id); setEditing(null); onChange(); }
    catch (err) { setError(err.response?.data?.detail || "Could not delete the window."); }
  }

  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Changes take effect immediately for new queues. Existing rooms can finish their games.</p><button className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => edit(null)} type="button">Add window</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{windows.map((item) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.id}><div className="flex items-start justify-between"><div><p className="text-lg font-bold text-slate-900">{item.weekday_name}</p><p className="mt-1 text-sm text-slate-600">{item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.is_enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.is_enabled ? "Enabled" : "Paused"}</span></div><p className="mt-3 text-xs text-slate-500">{item.timezone_name}</p><div className="mt-5 flex gap-3"><button className="text-sm font-semibold text-violet-700" onClick={() => edit(item)} type="button">Edit</button><button className="text-sm font-semibold text-rose-600" onClick={() => remove(item.id)} type="button">Delete</button></div></article>)}</div>
    {!windows.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No windows are configured. Add one to enable Game Night.</p> : null}
    {editing !== null ? <form className="max-w-xl space-y-4 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm" onSubmit={save}><h3 className="text-lg font-bold">{editing === "new" ? "Add a window" : "Edit window"}</h3><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Day<select className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" onChange={(e) => setForm((value) => ({ ...value, weekday: Number(e.target.value) }))} value={form.weekday}>{weekdayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className="text-sm font-medium">Timezone<input className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" onChange={(e) => setForm((value) => ({ ...value, timezone_name: e.target.value }))} required value={form.timezone_name} /></label><label className="text-sm font-medium">Start<input className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" onChange={(e) => setForm((value) => ({ ...value, start_time: e.target.value }))} required type="time" value={form.start_time} /></label><label className="text-sm font-medium">End<input className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" onChange={(e) => setForm((value) => ({ ...value, end_time: e.target.value }))} required type="time" value={form.end_time} /></label></div><label className="flex items-center gap-2 text-sm"><input checked={form.is_enabled} onChange={(e) => setForm((value) => ({ ...value, is_enabled: e.target.checked }))} type="checkbox" />Enabled</label>{error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}<div className="flex gap-3"><button className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving…" : "Save window"}</button><button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={() => setEditing(null)} type="button">Cancel</button></div></form> : null}
  </div>;
}

const activityColumns = {
  matches: [["Person 1", "member_a", null, "phone_a"], ["Person 2", "member_b", null, "phone_b"], ["Overall fit", "score", "%"], ["Astrology fit", "kundali_score", "/ 36"], ["Personality fit", "personality_score", "%"], ["Match type", "match_type"], ["Connection stage", "status"], ["Matched", "matched_at", "datetime"], ["Conversation", "message_count", "messages"], ["Last activity", "last_message_at", "datetime"]],
  conversations: [["Participants", "participants"], ["Sender", "sender"], ["Message", "content", "truncate"], ["Type", "message_type"], ["Status", "status"], ["Sent", "created_at", "date"]],
  games: [["Game", "game"], ["Category", "category"], ["Participants", "participants"], ["Started by", "started_by"], ["Status", "status"], ["Started", "created_at", "date"]],
};

const statusOptions = {
  recommendations: [["ready", "Ready"], ["shown", "Shown"], ["acted", "Acted"]],
  matches: [["suggested", "Suggested"], ["liked", "Liked"], ["matched", "Matched"], ["rejected", "Rejected"]],
  swipes: [["like", "Like"], ["pass", "Pass"]],
  safety: [["received", "Received"], ["in_review", "In review"], ["actioned", "Actioned"], ["closed", "Closed"]],
  appeals: [["submitted", "Submitted"], ["in_review", "In review"], ["upheld", "Upheld"], ["overturned", "Overturned"]],
};

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function calculateWeightedOverall(kundaliScore, personalityScore, astrologyWeight) {
  const kundali = Number(kundaliScore);
  const personality = Number(personalityScore);
  if (!Number.isFinite(kundali) || !Number.isFinite(personality)) return null;
  const personalityWeight = 100 - astrologyWeight;
  return Math.round((kundali / 36) * astrologyWeight + (personality / 100) * personalityWeight);
}

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function SectionSummary({ title, items = [] }) {
  if (!items.length) return null;
  return <section aria-label={`${title} summary`} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {items.map(({ label, value, note }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </article>)}
  </section>;
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminLogin(email, password);
      onLogin();
    } catch (err) {
      const status = Number(err.response?.status || 0);
      if (err.code === "ECONNABORTED") {
        setError("The admin server took too long to respond. Please try again.");
      } else if (err.request) {
        setError("Cannot reach the admin server. Start the backend or check the API URL, then try again.");
      } else if (status === 401 || status === 403) {
        setError("Email or password is incorrect, or this account does not have staff access.");
      } else if (status === 400) {
        setError("Enter a valid work email and password, then try again.");
      } else if (status === 429) {
        setError("Too many sign-in attempts. Wait a moment and try again.");
      } else if (status >= 500) {
        setError("Admin sign-in is temporarily unavailable. Please try again shortly.");
      } else {
        setError("Could not sign in. Check your details and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="tara-admin-login flex min-h-screen items-center justify-center bg-[#fafafa] px-5 py-10 text-slate-900">
      <div className="w-full max-w-[420px] rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles size={22} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-700">Tara</p><h1 className="text-xl font-bold">Admin portal</h1></div>
        </div>
        <p className="mb-6 text-sm leading-6 text-slate-500">Sign in with a staff account to view product activity and manage user data.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Work email<input autoComplete="username" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" placeholder="admin@tara.com" /></label>
          <label className="block text-sm font-semibold text-slate-700">Password<input autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" placeholder="Enter password" /></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button disabled={busy} className="h-12 w-full rounded-xl bg-violet-700 font-semibold text-white transition hover:bg-violet-800 disabled:opacity-60">{busy ? "Signing in…" : "Sign in to admin"}</button>
        </form>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck size={14} /> Staff access only</p>
      </div>
    </main>
  );
}

function StatCard({ label, value, note, icon: Icon, accent = "violet" }) {
  const palettes = {
    violet: "bg-violet-50 text-violet-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${palettes[accent]}`}><Icon size={19} /></span></div>
    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{formatNumber(value)}</p><p className="mt-2 text-xs text-slate-500">{note}</p>
  </article>;
}

function SignupChart({ data = [] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return <div className="flex h-48 items-end gap-3 border-b border-slate-100 px-1 pb-0 pt-5">
    {data.map((item) => <div key={item.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
      <span className="text-xs font-medium text-slate-500">{item.count}</span>
      <div className="w-full max-w-9 rounded-t-lg bg-violet-500 transition-all" style={{ height: `${Math.max(5, (item.count / max) * 100)}%` }} />
      <span className="pb-2 text-[11px] text-slate-400">{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${item.date}T12:00:00`))}</span>
    </div>)}
  </div>;
}

function Pager({ page, pageSize, count, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500"><span>{count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${count}` : "No records"}</span><div className="flex items-center gap-2"><button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span>{page} / {pages}</span><button aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>;
}

function AdminDataTable({ section, rows, astrologyWeight, onSelectUser, onOpenRecommendation }) {
  const tableClass = "w-full min-w-[900px] text-left text-sm";
  const headerClass = "bg-slate-50 text-xs uppercase tracking-wide text-slate-500";
  if (section === "users") return <table className={tableClass}><thead className={headerClass}><tr>{["Member", "Profile", "Joined", "Last active", "Recommendations", "Matches", "Status"].map((label) => <th className="px-4 py-4" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows?.results?.map((user) => <tr className="cursor-pointer hover:bg-violet-50/40" key={user.id} onClick={() => onSelectUser(user)}><td className="px-5 py-4"><p className="font-semibold">{user.name || "Unnamed user"}</p><p className="mt-1 text-xs text-slate-500">{user.email}</p><p className="mt-1 text-xs text-slate-400">{user.phone_number || "No phone"}</p></td><td className="px-4 py-4">{user.gender || "—"} · {user.photo_count} photos</td><td className="px-4 py-4">{formatDate(user.date_joined)}</td><td className="px-4 py-4">{formatDate(user.last_login)}</td><td className="px-4 py-4">{user.recommendation_count}</td><td className="px-4 py-4">{user.match_count}</td><td className="px-4 py-4">{user.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody></table>;
  if (section === "recommendations") return <table className="w-full min-w-[1450px] text-left text-sm"><thead className={headerClass}><tr>{["For member", "Recommended member", `Overall (${astrologyWeight}/${100 - astrologyWeight})`, "Astrology", "Personality", "Match type", "Queue state", "Outcome", "Swipe", "Created", "Shown", "Acted"].map((label) => <th className="px-4 py-4" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows?.results?.map((item) => <tr className="hover:bg-violet-50/40" key={item.id}><td className="px-5 py-4"><p className="font-semibold">{item.user_name || "Unnamed user"}</p><p className="text-xs text-slate-500">{item.user_email}</p></td><td className="px-4 py-4"><p className="font-semibold">{item.recommended_name || "Unnamed user"}</p><p className="text-xs text-slate-500">{item.recommended_email}</p></td><td className="px-4 py-4"><span className="font-semibold text-violet-700">{calculateWeightedOverall(item.kundali_score, item.personality_score, astrologyWeight) ?? Math.round(item.score)}%</span><button className="mt-1 block text-xs font-semibold text-violet-700 hover:underline" onClick={() => onOpenRecommendation(item)} type="button">View details</button></td><td className="px-4 py-4">{Math.round(item.kundali_score)} / 36</td><td className="px-4 py-4">{Math.round(item.personality_score)}%</td><td className="px-4 py-4">{item.match_type || "—"}</td><td className="px-4 py-4">{item.queue_status}</td><td className="px-4 py-4">{item.lifecycle_status}</td><td className="px-4 py-4">{item.swipe_action}</td><td className="px-4 py-4">{formatDateTime(item.created_at)}</td><td className="px-4 py-4">{formatDateTime(item.shown_at)}</td><td className="px-4 py-4">{formatDateTime(item.acted_at)}</td></tr>)}</tbody></table>;
  if (section === "swipes") return <table className="w-full min-w-[1050px] text-left text-sm"><thead className={headerClass}><tr>{["Who swiped", "On whom", "Decision", "Outcome", "Note", "Created", "Last updated"].map((label) => <th className="px-4 py-4" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows?.results?.map((item) => <tr key={item.id}><td className="px-5 py-4">{item.user_name} · #{item.user_id}<p className="text-xs text-slate-500">{item.user_email}</p></td><td className="px-4 py-4">{item.target_name} · #{item.target_user_id}<p className="text-xs text-slate-500">{item.target_email}</p></td><td className="px-4 py-4">{item.action}</td><td className="px-4 py-4">{item.is_mutual_match ? "Matched" : "No mutual match"}</td><td className="px-4 py-4">{item.has_note ? item.note_delivered_at ? "Delivered" : "Attached" : "—"}</td><td className="px-4 py-4">{formatDateTime(item.created_at)}</td><td className="px-4 py-4">{formatDateTime(item.updated_at)}</td></tr>)}</tbody></table>;
  return <table className={tableClass}><thead className={headerClass}><tr>{activityColumns[section].map(([label]) => <th className="px-4 py-4" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows?.results?.map((row) => <tr key={row.id}>{activityColumns[section].map(([label, field, format, subfield]) => <td className="px-4 py-4 text-slate-600" key={field}>{subfield ? <><p className="font-semibold text-slate-800">{row[field] || "Unknown user"}</p><p className="mt-1 text-xs text-slate-500">{row[subfield]}</p></> : format === "date" ? formatDate(row[field]) : format === "datetime" ? formatDateTime(row[field]) : format === "messages" ? row[field] ? `Started · ${row[field]} text messages` : "Not started" : format === "%" ? `${row[field]}%` : format === "/ 36" ? `${row[field]} / 36` : row[field]}</td>)}</tr>)}</tbody></table>;
}

function AdminPortalApp({ onLogout }) {
  const [section, setSection] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [recommendationDetail, setRecommendationDetail] = useState(null);
  const [recommendationDetailLoading, setRecommendationDetailLoading] = useState(false);
  const [recommendationDetailError, setRecommendationDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [astrologyWeight, setAstrologyWeight] = useState(80);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (section === "overview") setOverview(await getAdminOverview());
      if (section === "users") setRows(await getAdminUsers({ q: query, page }));
      if (section === "recommendations") setRows(await getAdminRecommendations({ q: query, page, status: statusFilter }));
      if (section === "matches") setRows(await getAdminMatches({ q: query, page, status: statusFilter }));
      if (section === "swipes") setRows(await getAdminSwipes({ q: query, page, status: statusFilter }));
      if (section === "conversations") setRows(await getAdminConversations({ q: query, page }));
      if (section === "games") setRows(await getAdminGames({ q: query, page }));
      if (section === "game-night") setRows(await getAdminGameNightWindows());
      if (section === "safety") setRows(await getAdminSafetyReports(statusFilter));
      if (section === "appeals") setRows(await getAdminSafetyAppeals(statusFilter));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load admin data. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [section, query, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const logout = () => { clearAdminToken(); onLogout(); };
  const heading = useMemo(() => navItems.find((item) => item.id === section)?.label || "Overview", [section]);
  const sectionTitle = sectionCopy[section]?.[0];
  const sectionDescription = sectionCopy[section]?.[1];
  const submitSearch = (event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); };
  const openRecommendation = async (recommendation) => {
    setSelectedUser(null);
    setSelectedRecommendation(recommendation);
    setRecommendationDetail(null);
    setRecommendationDetailError("");
    setRecommendationDetailLoading(true);
    try {
      setRecommendationDetail(await getAdminRecommendationDetail(recommendation.id));
    } catch (detailError) {
      setRecommendationDetailError(detailError.response?.data?.detail || "Could not load recommendation details.");
    } finally {
      setRecommendationDetailLoading(false);
    }
  };
  const closeRecommendation = useCallback(() => { setSelectedRecommendation(null); setRecommendationDetail(null); setRecommendationDetailError(""); }, []);
  const goTo = (next) => { setSection(next); setRows(null); setPage(1); setQuery(""); setSearch(""); setStatusFilter(""); setSelectedUser(null); closeRecommendation(); };

  return <div className="tara-admin min-h-screen bg-[#fafafa] text-slate-900">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={20} /></span><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-700">Tara</p><p className="font-semibold">Admin console</p></div></div>
      <p className="mb-2 mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
      <nav className="space-y-1">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => goTo(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${section === id ? "bg-violet-50 text-violet-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={18} />{label}</button>)}</nav>
      <div className="mt-auto rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} className="text-emerald-600" />Protected workspace</div><p className="mt-2 text-xs leading-5 text-slate-500">Admin access is limited to authorized staff accounts.</p></div>
    </aside>
    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700 lg:hidden"><Sparkles size={18} /></span><div><p className="text-xs text-slate-400">Tara / Admin</p><h1 className="font-semibold">{heading}</h1></div></div>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />System operational</span><button aria-label="Sign out" onClick={logout} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button></div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => goTo(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${section === id ? "bg-violet-50 font-semibold text-violet-800" : "text-slate-500"}`}><Icon size={16} />{label}</button>)}</nav>
      <main className="mx-auto max-w-[1440px] p-5 sm:p-8">
        {error && <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}<button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
        {loading && <div className="grid min-h-48 place-items-center text-sm text-slate-400">Loading admin data…</div>}
        {!loading && section === "overview" && overview && <>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold tracking-tight">Good to see you</h2><p className="mt-1 text-sm text-slate-500">Here’s what’s happening across Tara today.</p></div><button onClick={load} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Refresh data</button></div>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total users" value={overview.users} note={`${formatNumber(overview.new_users_today)} joined today`} icon={Users} accent="violet" />
            <StatCard label="Active this week" value={overview.active_users_week} note="Users with recent sign-in" icon={Activity} accent="blue" />
            <StatCard label="Recommendations" value={overview.recommendations} note="Generated recommendations" icon={Sparkles} accent="amber" />
            <StatCard label="Mutual matches" value={overview.matches} note="Successful connections" icon={Heart} accent="rose" />
            <StatCard label="Messages" value={overview.messages} note="Across conversations" icon={MessageCircle} accent="blue" />
            <StatCard label="Game sessions" value={overview.game_sessions} note="Conversation games started" icon={ClipboardList} accent="violet" />
            <StatCard label="Swipes today" value={overview.swipes_today} note="Likes and passes" icon={ArrowUpRight} accent="amber" />
            <StatCard label="Unread notifications" value={overview.unread_notifications} note={`${formatNumber(overview.realtime_matches)} realtime matches`} icon={Bell} accent="rose" />
          </section>
          <section className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-1 flex items-center justify-between"><div><h3 className="font-semibold">Sign-ups</h3><p className="mt-1 text-sm text-slate-500">Daily registrations over the last week</p></div><span className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">7 days</span></div><SignupChart data={overview.signups} /></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Recently joined</h3><p className="mt-1 text-sm text-slate-500">Latest user accounts</p></div><button onClick={() => goTo("users")} className="text-sm font-semibold text-violet-700 hover:text-violet-900">View all</button></div><div className="space-y-4">{overview.recent_users.map((user) => <button onClick={() => { goTo("users"); setSearch(user.email); setQuery(user.email); }} key={user.id} className="flex w-full items-center gap-3 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><CircleUserRound size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name || "Unnamed user"}</span><span className="block truncate text-xs text-slate-500">{user.email}</span></span><span className="text-right"><span className={`block text-[11px] font-semibold ${user.is_active ? "text-emerald-600" : "text-slate-400"}`}>{user.is_active ? "Active" : "Inactive"}</span><span className="text-[11px] text-slate-400">{formatDate(user.date_joined)}</span></span></button>)}</div></article>
          </section>
        </>}
        {!loading && section !== "overview" && <>
          <div className="mb-6"><h2 className="text-2xl font-bold tracking-tight">{sectionTitle}</h2><p className="mt-1 text-sm text-slate-500">{sectionDescription}</p></div>
          {section === "matches" && <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm leading-6 text-violet-950"><p className="font-semibold">How to read this table</p><p className="mt-1"><strong>Overall fit</strong> is the combined score out of 100. <strong>Astrology fit</strong> is the traditional score out of 36. <strong>Personality fit</strong> is out of 100.</p><p className="mt-1"><strong>Connection stage</strong> shows the current state: Suggested, Liked, Matched, or Rejected. Only “Matched” means both people have connected.</p></div>}
          {section === "recommendations" && <SectionSummary title="Recommendations" items={[
            { label: "Generated", value: rows?.summary?.total },
            { label: "Ready", value: rows?.summary?.ready },
            { label: "Shown", value: rows?.summary?.shown },
            { label: "Acted on", value: rows?.summary?.acted },
            { label: "Jobs pending", value: rows?.summary?.generation_pending },
            { label: "Jobs running", value: rows?.summary?.generation_running },
            { label: "Jobs completed", value: rows?.summary?.generation_completed },
            { label: "Jobs failed", value: rows?.summary?.generation_failed },
          ]} />}
          {section === "recommendations" && <section aria-label="Overall score weights" className="mb-5 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold text-slate-900">Overall score weights</h3><p className="mt-1 text-sm text-slate-500">Adjust the balance. The two percentages always add up to 100.</p></div>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setAstrologyWeight(80)} type="button">Reset to 80 / 20</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <label className="block"><span className="mb-2 flex justify-between text-sm font-medium text-slate-700"><span>Astrology</span><span>{astrologyWeight}%</span></span><input aria-label="Astrology weight" className="h-2 w-full cursor-pointer accent-violet-700" max="100" min="0" onChange={(event) => setAstrologyWeight(Number(event.target.value))} type="range" value={astrologyWeight} /></label>
              <span aria-hidden="true" className="hidden text-slate-300 sm:block">+</span>
              <div className="text-sm font-medium text-slate-700 sm:text-right">Personality <span className="ml-2 text-violet-700">{100 - astrologyWeight}%</span></div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">The Overall column and recommendation detail preview recalculate from the saved Astrology and Personality scores. These weights change the admin display; they don’t change saved scores or member-facing rankings.</p>
          </section>}
          {section === "matches" && <SectionSummary title="Matches" items={[
            { label: "All pairs", value: rows?.summary?.total },
            { label: "Mutual matches", value: rows?.summary?.matched },
            { label: "One-way likes", value: rows?.summary?.liked },
            { label: "Suggested", value: rows?.summary?.suggested, note: `${formatNumber(rows?.summary?.rejected)} rejected` },
          ]} />}
          {section === "swipes" && <SectionSummary title="Swipes" items={[
            { label: "Total decisions", value: rows?.summary?.total },
            { label: "Likes", value: rows?.summary?.likes },
            { label: "Passes", value: rows?.summary?.passes },
            { label: "Matched pairs", value: rows?.summary?.matches },
          ]} />}
          {section === "game-night" ? <GameNightAdminPanel onChange={load} windows={rows || []} /> : null}
          {section === "safety" ? <SafetyQueue onChange={load} reports={rows || []} /> : null}
          {section === "appeals" ? <SafetyAppealsQueue appeals={rows || []} onChange={load} /> : null}
          {section !== "game-night" && section !== "safety" && section !== "appeals" ? <>
          <form onSubmit={submitSearch} className="mb-4 flex max-w-3xl flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={section === "users" ? "Search name, email, or phone" : "Search by member name or email"} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" /></div>
            {statusOptions[section] && <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"><option value="">All statuses</option>{statusOptions[section].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
            <button className="rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800">Search</button>
          </form>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <AdminDataTable section={section} rows={rows} astrologyWeight={astrologyWeight} onSelectUser={setSelectedUser} onOpenRecommendation={openRecommendation} />
              {!rows?.results?.length && <div className="px-6 py-16 text-center text-sm text-slate-400">No records found.</div>}
            </div>
            {rows && <Pager page={rows.page} pageSize={rows.page_size} count={rows.count} onPage={setPage} />}
          </div>
          </> : null}
          {selectedUser && <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/30" onClick={() => setSelectedUser(null)}><section onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-700">User profile · #{selectedUser.id}</p><h3 className="mt-2 text-2xl font-bold">{selectedUser.name || "Unnamed user"}</h3></div><button onClick={() => setSelectedUser(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div><p className="mt-1 text-sm text-slate-500">{selectedUser.email}</p>{selectedUser.photos?.length > 0 && <div className="mt-5 grid grid-cols-3 gap-2">{selectedUser.photos.map((photo) => <img key={photo} src={photo} alt="Member profile" className="aspect-square w-full rounded-xl object-cover" />)}</div>}<div className="mt-7 grid grid-cols-2 gap-3">{[["Phone", selectedUser.phone_number || "—"], ["Gender", selectedUser.gender || "—"], ["Preference", selectedUser.preference || "—"], ["Birth date", selectedUser.date_of_birth || "—"], ["Birth place", selectedUser.birth_place || "—"], ["Birth time", selectedUser.birth_time || "—"], ["Joined", formatDate(selectedUser.date_joined)], ["Last active", formatDate(selectedUser.last_login)], ["Photos", selectedUser.photo_count], ["Matches", selectedUser.match_count], ["Recommendations", selectedUser.recommendation_count]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold capitalize text-slate-700">{value}</p></div>)}</div><div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">Bio</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedUser.bio || "No bio added."}</p></div><div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">Interests</p><p className="mt-2 text-sm text-slate-700">{Array.isArray(selectedUser.interests) && selectedUser.interests.length ? selectedUser.interests.join(", ") : "No interests added."}</p></div>{selectedUser.kundali && <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4"><p className="font-semibold text-violet-900">Astrology profile</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p><span className="text-slate-500">Sun:</span> {selectedUser.kundali.sun_sign || "—"}</p><p><span className="text-slate-500">Moon:</span> {selectedUser.kundali.moon_sign || "—"}</p><p><span className="text-slate-500">Lagna:</span> {selectedUser.kundali.lagna || "—"}</p><p><span className="text-slate-500">Nakshatra:</span> {selectedUser.kundali.nakshatra || "—"}</p></div></div>}</section></div>}
        </>}
        <RecommendationDetailPanel
          recommendation={selectedRecommendation}
          detail={recommendationDetail}
          loading={recommendationDetailLoading}
          error={recommendationDetailError}
          onClose={closeRecommendation}
          astrologyWeight={astrologyWeight}
        />
      </main>
    </div>
  </div>;
}

export default function AdminPortal() {
  const [authenticated, setAuthenticated] = useState(Boolean(getAdminToken()));
  useEffect(() => {
    const expire = () => setAuthenticated(false);
    window.addEventListener("tara-admin-auth-expired", expire);
    return () => window.removeEventListener("tara-admin-auth-expired", expire);
  }, []);
  return authenticated ? <AdminPortalApp onLogout={() => setAuthenticated(false)} /> : <LoginScreen onLogin={() => setAuthenticated(true)} />;
}
