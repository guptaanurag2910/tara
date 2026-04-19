import { Link, useNavigate } from "react-router-dom";

import Button from "../components/Button";

const EDIT_ITEMS = [
  { key: "name", label: "Name", hint: "How your name appears on profile" },
  { key: "dob", label: "Date of Birth", hint: "Must be 18+ to use Tara" },
  { key: "gender", label: "Gender", hint: "How you identify" },
  { key: "preferences", label: "Preferences", hint: "Who you are interested in" },
  { key: "photos", label: "Photos", hint: "Add, remove or reorder photos" },
  { key: "bio", label: "Bio", hint: "A short about-you line" },
  { key: "interests", label: "Interests", hint: "Choose tags that represent you" },
];

export default function EditProfile() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Edit Profile</h1>
          <p className="text-xs text-slate-300">Update one section at a time</p>
        </div>
        <Button fullWidth={false} onClick={() => navigate("/profile")} variant="ghost">
          Done
        </Button>
      </header>

      <section className="space-y-2 rounded-2xl border border-white/15 bg-slate-900/65 p-3 shadow-xl shadow-black/20">
        {EDIT_ITEMS.map((item) => (
          <Link
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 transition hover:border-white/25"
            key={item.key}
            to={`/profile/edit/${item.key}`}
          >
            <div>
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-slate-300">{item.hint}</p>
            </div>
            <span className="text-sm text-slate-300">›</span>
          </Link>
        ))}
      </section>

      <div className="mt-4">
        <Link
          className="block rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-medium text-slate-100"
          to="/profile"
        >
          Preview Profile
        </Link>
      </div>
    </main>
  );
}

