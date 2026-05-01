import axios from "axios";

import { clearStoredAuth, getStoredToken } from "./tokenStorage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token !== null) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const isFormData =
    typeof FormData !== "undefined" && config?.data instanceof FormData;

  if (isFormData) {
    if (typeof config.headers?.delete === "function") {
      config.headers.delete("Content-Type");
    } else if (typeof config.headers?.set === "function") {
      config.headers.set("Content-Type", null);
    } else if (config.headers) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
  } else if (config.method && !["get", "head", "options"].includes(String(config.method).toLowerCase())) {
    if (typeof config.headers?.set === "function") {
      if (!config.headers.get("Content-Type")) {
        config.headers.set("Content-Type", "application/json");
      }
    } else {
      const hasContentType = Boolean(config.headers?.["Content-Type"] || config.headers?.["content-type"]);
      if (!hasContentType) {
        config.headers["Content-Type"] = "application/json";
      }
    }
  }

  return config;
});

function normalizeApiError(error) {
  const status = error?.response?.status ?? 0;
  const data = error?.response?.data;
  const fallbackMessage = "Something went wrong. Please try again.";
  const rawMessage = String(error?.message || "").trim();
  const isTimeout =
    error?.code === "ECONNABORTED" ||
    /timed?\s*out/i.test(rawMessage) ||
    /timeout/i.test(rawMessage);
  const isNetworkError = !error?.response && !isTimeout;

  const extractFieldMessage = () => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length > 0) {
        const first = value.find((entry) => typeof entry === "string");
        if (first) {
          return first;
        }
      }
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
    return null;
  };

  const extractedMessage =
    data?.detail ||
    data?.message ||
    extractFieldMessage() ||
    (typeof data === "string" ? data : null) ||
    rawMessage ||
    fallbackMessage;

  const isGenericServerMessage =
    /request failed with status code 5\d\d/i.test(extractedMessage) ||
    /^internal server error$/i.test(extractedMessage) ||
    /^server error$/i.test(extractedMessage) ||
    /^network error$/i.test(extractedMessage);

  let message = extractedMessage;
  if (isTimeout) {
    message = "The request took too long. Please try again.";
  } else if (isNetworkError) {
    message = "Cannot reach the server. Check your connection and try again.";
  } else if (status >= 500 && isGenericServerMessage) {
    message = "Something went wrong on our side. Please try again.";
  }

  return {
    status,
    message,
    details: data ?? null,
    isTimeout,
    isNetworkError,
    isRetryable: isTimeout || isNetworkError || status >= 500,
    raw: error,
  };
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredAuth();
    }
    return Promise.reject(normalizeApiError(error));
  }
);

export default api;
export { normalizeApiError };
