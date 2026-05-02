import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { fetchMyBirthDetails, upsertBirthDetails } from "../services/astrologyService";
import BirthTimeClock from "./BirthTimeClock";
import Button from "./Button";
import Input from "./Input";
import Loader from "./Loader";
import LocationInput from "./LocationInput";

function normalizeTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const matched = raw.match(/^(\d{2}:\d{2})/);
  return matched ? matched[1] : "";
}

function isPastDate(value) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}

function toFormState(payload) {
  return {
    date_of_birth: payload?.date_of_birth || "",
    time_of_birth: normalizeTime(payload?.time_of_birth),
    place_of_birth: payload?.place_of_birth || "",
    latitude: payload?.latitude !== undefined && payload?.latitude !== null ? String(payload.latitude) : "",
    longitude: payload?.longitude !== undefined && payload?.longitude !== null ? String(payload.longitude) : "",
    is_default_location: Boolean(payload?.is_default_location),
  };
}

export default function BirthDetailsForm({ initialValues = null, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(toFormState(initialValues));
  const [method, setMethod] = useState("post");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchMyBirthDetails();
        if (!active) return;
        const next = toFormState(data || initialValues || {});
        setForm(next);
        setMethod(next.date_of_birth ? "put" : "post");
      } catch (apiError) {
        if (!active) return;
        setError(apiError?.message || "Could not load birth details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [initialValues]);

  const actionLabel = useMemo(() => (method === "put" ? "Update details" : "Save details"), [method]);

  const onFieldChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setMessage("");
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const onTimeChange = (nextTime) => {
    setError("");
    setMessage("");
    setForm((previous) => ({ ...previous, time_of_birth: nextTime }));
  };

  const onLocationChange = (locationPayload) => {
    setError("");
    setMessage("");
    setForm((previous) => ({
      ...previous,
      place_of_birth: String(locationPayload?.place_of_birth || ""),
      latitude: String(locationPayload?.latitude || ""),
      longitude: String(locationPayload?.longitude || ""),
      is_default_location: Boolean(locationPayload?.is_default_location),
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!String(form.date_of_birth || "").trim()) {
      setError("Date of birth is required.");
      return;
    }
    if (!isPastDate(form.date_of_birth)) {
      setError("Date of birth must be in the past.");
      return;
    }
    if (!String(form.place_of_birth || "").trim()) {
      setError("Place of birth is required.");
      return;
    }
    if (!String(form.latitude || "").trim() || !String(form.longitude || "").trim()) {
      setError("Please choose a location so we can capture accurate coordinates.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date_of_birth: form.date_of_birth,
        time_of_birth: form.time_of_birth || null,
        place_of_birth: form.place_of_birth,
        is_default_location: Boolean(form.is_default_location),
      };

      if (String(form.latitude || "").trim() && String(form.longitude || "").trim()) {
        payload.latitude = form.latitude;
        payload.longitude = form.longitude;
      }

      const response = await upsertBirthDetails(payload, method);
      const normalized = toFormState(response);
      setForm(normalized);
      setMethod("put");
      setMessage("Birth details saved. Kundali is being refreshed.");

      if (typeof onSaved === "function") {
        onSaved(response);
      }
    } catch (apiError) {
      setError(apiError?.message || "Could not save birth details right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="tara-screen-panel p-5"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-4">
        <p className="tara-kicker">Birth details</p>
        <h2 className="font-serif text-2xl text-[color:var(--tara-text-primary)]">Birth Details</h2>
        <p className="mt-1 text-xs text-[color:var(--tara-text-secondary)]">Update once, and we auto-regenerate your chart.</p>
      </div>

      {loading ? <Loader text="Loading your birth details..." /> : null}

      {!loading ? (
        <form className="space-y-3" onSubmit={onSubmit}>
          <Input id="astro-dob" label="Date of Birth" name="date_of_birth" onChange={onFieldChange} type="date" value={form.date_of_birth} />
          <BirthTimeClock label="Time of Birth (Optional)" manualInputId="astro-tob" onChange={onTimeChange} value={form.time_of_birth} />
          <LocationInput
            value={{
              place_of_birth: form.place_of_birth,
              latitude: form.latitude,
              longitude: form.longitude,
              is_default_location: form.is_default_location,
            }}
            onChange={onLocationChange}
          />

          {error ? <p className="tara-alert tara-alert-error">{error}</p> : null}
          {message ? <p className="tara-alert tara-alert-success">{message}</p> : null}

          <Button loading={saving} type="submit">
            {actionLabel}
          </Button>
        </form>
      ) : null}
    </motion.section>
  );
}
