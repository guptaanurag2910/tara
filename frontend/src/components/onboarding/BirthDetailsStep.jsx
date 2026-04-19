import Button from "../Button";
import BirthTimeClock from "../BirthTimeClock";
import Input from "../Input";
import LocationInput from "../LocationInput";

export default function BirthDetailsStep({
  form,
  onChange,
  onBack,
  onAutoDetect,
  onNext,
  loading,
  actionLabel = "Save & Continue",
}) {
  return (
    <div className="space-y-4 onboarding-step-enter">
      <h2 className="text-lg font-semibold text-white">Birth Details</h2>

      <LocationInput
        value={{
          place_of_birth: form.birth_place || form.place_of_birth || "",
          latitude: form.latitude,
          longitude: form.longitude,
          is_default_location: form.is_default_location,
        }}
        onChange={(next) => {
          onChange({ target: { name: "birth_place", value: next.place_of_birth } });
          onChange({ target: { name: "latitude", value: next.latitude } });
          onChange({ target: { name: "longitude", value: next.longitude } });
          onChange({
            target: {
              name: "is_default_location",
              value: next.is_default_location,
              type: "checkbox",
              checked: next.is_default_location,
            },
          });
        }}
      />

      <Button fullWidth variant="ghost" onClick={onAutoDetect}>
        Refresh Current Location
      </Button>

      <BirthTimeClock
        label="Birth Time (Optional)"
        manualInputId="birth_time"
        onChange={(nextTime) => onChange({ target: { name: "birth_time", value: nextTime } })}
        value={form.birth_time}
      />

      <p className="rounded-xl bg-indigo-300/10 px-3 py-2 text-xs text-indigo-100">
        Add time for better compatibility 🔮
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Button fullWidth variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button fullWidth loading={loading} onClick={onNext}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
