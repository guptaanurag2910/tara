import { useEffect, useState } from "react";

import { fetchMyBirthDetails, upsertBirthDetails } from "../services/astrologyService";
import Button from "./Button";
import Loader from "./Loader";
import LocationInput from "./LocationInput";

function normalizeTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const matched = raw.match(/^(\d{2}:\d{2})/);
  return matched ? matched[1] : "";
}

function isPastDate(value) {
  const matched = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return false;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed < today;
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
        if (apiError?.status === 404) {
          setForm(toFormState(initialValues || {}));
          setMethod("post");
        } else {
          setError(apiError?.message || "Could not load birth details.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [initialValues]);

  const actionLabel = method === "put" ? "Update details" : "Save details";

  const onFieldChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setMessage("");
    setForm((previous) => ({ ...previous, [name]: value }));
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
    <section className="birth-details-editor">
      {loading ? <Loader text="Loading your birth details..." /> : null}

      {!loading ? (
        <form className="birth-details-fields" onSubmit={onSubmit}>
          <p className="birth-details-intro">Use the details you know. Your chart updates when you save.</p>
          <label className="birth-details-field" htmlFor="astro-dob">
            <span>Date of birth</span>
            <input className="tara-input w-full" id="astro-dob" name="date_of_birth" onChange={onFieldChange} required type="date" value={form.date_of_birth} />
          </label>
          <label className="birth-details-field" htmlFor="astro-tob">
            <span>Time of birth <small>(optional)</small></span>
            <input className="tara-input w-full" id="astro-tob" name="time_of_birth" onChange={onFieldChange} type="time" value={form.time_of_birth} />
          </label>
          <p className="birth-details-hint">Leave this blank if you don't know it. Lagna and houses may be uncertain.</p>
          <div className="birth-details-field">
            <span>Place of birth</span>
            <LocationInput
              autoDetect={false}
              onChange={onLocationChange}
              placeholder="Search your place of birth"
              simple
              value={{
                place_of_birth: form.place_of_birth,
                latitude: form.latitude,
                longitude: form.longitude,
                is_default_location: form.is_default_location,
              }}
            />
            <small className="birth-details-hint">Select a result to use its coordinates and timezone.</small>
          </div>

          {error ? <p className="birth-details-error" role="alert">{error}</p> : null}
          {message ? <p className="birth-details-success" role="status">{message}</p> : null}

          <Button loading={saving} type="submit">
            {actionLabel}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
