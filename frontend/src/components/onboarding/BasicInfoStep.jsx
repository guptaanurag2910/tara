import Button from "../Button";
import Input from "../Input";

export default function BasicInfoStep({ form, onChange, onNext, loading, actionLabel = "Save & Continue" }) {
  return (
    <div className="space-y-4 onboarding-step-enter">
      <h2 className="text-lg font-semibold text-white">Tell us about yourself</h2>
      <Input id="name" label="Name" name="name" onChange={onChange} value={form.name} />

      <Input
        id="date_of_birth"
        label="Date of Birth"
        name="date_of_birth"
        onChange={onChange}
        type="date"
        value={form.date_of_birth}
      />

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-slate-200">Gender</span>
        <select
          className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-white focus:border-pink-400 focus:outline-none"
          name="gender"
          onChange={onChange}
          value={form.gender}
        >
          <option className="text-slate-900" value="female">
            Female
          </option>
          <option className="text-slate-900" value="male">
            Male
          </option>
          <option className="text-slate-900" value="non_binary">
            Non Binary
          </option>
          <option className="text-slate-900" value="other">
            Other
          </option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-slate-200">Preference</span>
        <select
          className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-white focus:border-pink-400 focus:outline-none"
          name="preference"
          onChange={onChange}
          value={form.preference}
        >
          <option className="text-slate-900" value="male">
            Male
          </option>
          <option className="text-slate-900" value="female">
            Female
          </option>
          <option className="text-slate-900" value="everyone">
            Everyone
          </option>
        </select>
      </label>

      <Button loading={loading} onClick={onNext}>
        {actionLabel}
      </Button>
    </div>
  );
}
