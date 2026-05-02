import { Link, useNavigate } from "react-router-dom";

import Button from "../components/Button";

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
  const navigate = useNavigate();

  return (
    <main className="tara-page-shell-compact px-5 pb-28 pt-6">
      <header className="tara-screen-intro mb-4 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="tara-kicker">Profile details</p>
            <h1 className="tara-type-section mt-2 text-[2.2rem]">Edit Profile</h1>
            <p className="tara-copy mt-2 text-sm">Update one section at a time.</p>
          </div>
          <Button fullWidth={false} onClick={() => navigate("/profile")} variant="ghost">
            Done
          </Button>
        </div>
      </header>

      <section className="tara-screen-panel space-y-2 p-3">
        {EDIT_ITEMS.map((item) => (
          <Link
            className="tara-list-row flex items-center justify-between gap-3 px-4 py-3"
            key={item.key}
            to={`/profile/edit/${item.key}`}
          >
            <div>
              <p className="text-sm font-medium text-[color:var(--tara-text-primary)]">{item.label}</p>
              <p className="text-xs text-[color:var(--tara-text-secondary)]">{item.hint}</p>
            </div>
            <span className="text-sm text-[color:var(--tara-text-faint)]">›</span>
          </Link>
        ))}
      </section>

      <div className="mt-4">
        <Link
          className="tara-secondary-btn tara-motion-pressable flex items-center justify-center px-4 py-3 text-sm font-medium"
          to="/profile"
        >
          Preview Profile
        </Link>
      </div>
    </main>
  );
}
