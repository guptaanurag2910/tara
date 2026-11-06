import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";

const EDIT_ITEMS = [
  { key: "name", label: "Name", hint: "How your name appears on profile" },
  { key: "dob", label: "Date of Birth", hint: "Must be 18+ to use Tara" },
  { key: "gender", label: "Gender", hint: "How you identify" },
  { key: "preferences", label: "Preferences", hint: "Who you are interested in" },
  { key: "birth-details", label: "Birth Details", hint: "Birth date, time and place for your kundali" },
  { key: "photos", label: "Photos", hint: "Add, remove or reorder photos" },
  { key: "bio", label: "Bio", hint: "A short about-you line" },
  { key: "interests", label: "Interests", hint: "Choose tags that represent you" },
];

export default function EditProfile() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <main className="tara-edit-menu tara-container">
      <header className="edit-menu-header">
        <div className="edit-menu-brand">tara<span>.</span></div>
        <button aria-label="Back to profile" className="edit-menu-back" onClick={() => navigate("/profile")} type="button"><ArrowLeft size={19} /></button>
        <p className="edit-menu-eyebrow">MAKE IT YOURS</p>
        <h1>Edit Profile</h1>
        <p>Update one section at a time.</p>
        {location.state?.saved ? <p aria-live="polite" className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100" role="status">Saved</p> : null}
      </header>

      <section aria-label="Profile sections" className="edit-menu-list">
        {EDIT_ITEMS.map((item) => (
          <Link
            className="edit-menu-row"
            key={item.key}
            to={`/profile/edit/${item.key}`}
          >
            <div>
              <strong>{item.label}</strong>
              <p>{item.hint}</p>
            </div>
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
        ))}
      </section>

      <div className="edit-menu-footer">
        <Link
          className="edit-menu-preview"
          to="/profile"
        >
          Preview Profile
        </Link>
      </div>
    </main>
  );
}
