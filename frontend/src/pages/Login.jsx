import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";

import Logo from "../components/tara/Logo";
import { useAuth } from "../hooks/useAuth";
import { isOnboardingComplete } from "../services/onboardingStorage";

const OTP_CODE = "123456";
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

const COUNTRIES = [
  { code: "+91", flag: "🇮🇳", name: "India", minDigits: 10, maxDigits: 10 },
  { code: "+1", flag: "🇺🇸", name: "United States", minDigits: 10, maxDigits: 10 },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom", minDigits: 10, maxDigits: 10 },
  { code: "+971", flag: "🇦🇪", name: "UAE", minDigits: 9, maxDigits: 9 },
  { code: "+61", flag: "🇦🇺", name: "Australia", minDigits: 9, maxDigits: 9 },
  { code: "+65", flag: "🇸🇬", name: "Singapore", minDigits: 8, maxDigits: 8 },
];

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function getModeFromUrl() {
  if (typeof window === "undefined") {
    return "signup";
  }
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "login" || mode === "forgot" || mode === "signup") {
    return mode;
  }
  return "signup";
}

export default function Login() {
  const { token, user, login, signup, resetPassword, loading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(getModeFromUrl());
  const [signupStep, setSignupStep] = useState("phone");
  const [forgotStep, setForgotStep] = useState("phone");

  const [country, setCountry] = useState(COUNTRIES[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const otpRefs = useRef([]);

  const phoneDigits = useMemo(
    () => onlyDigits(phone).slice(0, country.maxDigits),
    [phone, country.maxDigits],
  );
  const fullPhone = `${country.code}${phoneDigits}`;
  const canUsePhone = phoneDigits.length >= country.minDigits;
  const canUseOtp = otp.length === OTP_LENGTH;

  useEffect(() => {
    if (!token) {
      return;
    }
    navigate(isOnboardingComplete(user?.id) ? "/discover" : "/onboarding", { replace: true });
  }, [token, user, navigate]);

  useEffect(() => {
    const inOtpStep =
      (mode === "signup" && signupStep === "otp") ||
      (mode === "forgot" && forgotStep === "otp");
    if (!inOtpStep || seconds <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, signupStep, forgotStep, seconds]);

  useEffect(() => {
    const inOtpStep =
      (mode === "signup" && signupStep === "otp") ||
      (mode === "forgot" && forgotStep === "otp");
    if (!inOtpStep) {
      return;
    }
    window.setTimeout(() => otpRefs.current[0]?.focus(), 20);
  }, [mode, signupStep, forgotStep]);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setSignupStep("phone");
    setForgotStep("phone");
    setOtp("");
    setPassword("");
    setNewPassword("");
    setSeconds(RESEND_SECONDS);
    setPickerOpen(false);
    resetMessages();
    navigate(`/auth?mode=${nextMode}`, { replace: true });
  };

  const onBack = () => {
    if (mode === "signup" && signupStep !== "phone") {
      if (signupStep === "password") {
        setSignupStep("otp");
      } else {
        setSignupStep("phone");
      }
      resetMessages();
      return;
    }
    if (mode === "forgot" && forgotStep !== "phone") {
      setForgotStep("phone");
      resetMessages();
      return;
    }
    navigate(-1);
  };

  const onSendCodeSignup = () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
      return;
    }
    setOtp("");
    setSeconds(RESEND_SECONDS);
    setSignupStep("otp");
    setPickerOpen(false);
  };

  const onVerifySignupOtp = () => {
    resetMessages();
    if (!canUseOtp) {
      return;
    }
    if (otp !== OTP_CODE) {
      setError("Incorrect OTP. Use 123456.");
      return;
    }
    setSignupStep("password");
  };

  const onCreateAccount = async () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
      return;
    }
    if (otp !== OTP_CODE) {
      setError("Invalid OTP. Use 123456.");
      return;
    }
    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await signup({
        phone_number: fullPhone,
        otp,
        password: password.trim(),
        name: `Tara ${phoneDigits.slice(-4)}`,
      });
      setInfo("Account created successfully.");
    } catch (apiError) {
      setError(apiError?.message || "Could not create account.");
    }
  };

  const onLogin = async () => {
    resetMessages();
    if (!canUsePhone || !password.trim()) {
      setError("Enter phone number and password.");
      return;
    }
    try {
      await login({
        phone_number: fullPhone,
        password: password.trim(),
      });
    } catch (apiError) {
      setError(apiError?.message || "Login failed.");
    }
  };

  const onSendCodeForgot = () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
      return;
    }
    setOtp("");
    setNewPassword("");
    setSeconds(RESEND_SECONDS);
    setForgotStep("otp");
    setPickerOpen(false);
  };

  const onResetPassword = async () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
      return;
    }
    if (otp !== OTP_CODE) {
      setError("Incorrect OTP. Use 123456.");
      return;
    }
    if (newPassword.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await resetPassword({
        phone_number: fullPhone,
        otp,
        new_password: newPassword.trim(),
      });
      setInfo("Password reset successful. Please login.");
      setForgotStep("phone");
      setMode("login");
      setPassword("");
      navigate("/auth?mode=login", { replace: true });
    } catch (apiError) {
      setError(apiError?.message || "Could not reset password.");
    }
  };

  const setDigit = (index, value) => {
    const digit = onlyDigits(value).slice(-1);
    const arr = otp.padEnd(OTP_LENGTH, " ").split("");
    arr[index] = digit || " ";
    const next = arr.join("").trimEnd();
    setOtp(next);
    setError("");
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const onOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const onOtpPaste = (event) => {
    const pasted = onlyDigits(event.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    setOtp(pasted);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const resendCode = () => {
    if (seconds > 0) {
      return;
    }
    setOtp("");
    setSeconds(RESEND_SECONDS);
    setError("");
    otpRefs.current[0]?.focus();
  };

  const renderPhoneInput = (placeholder = "98765 43210") => (
    <div className="mt-10">
      <div className="flex items-stretch gap-2">
        <button
          onClick={() => setPickerOpen((prev) => !prev)}
          className="flex min-w-[116px] items-center gap-2 rounded-2xl glass-strong px-4 text-base font-medium text-[color:var(--tara-text-primary)]"
          type="button"
          aria-label="Select country"
        >
          <span className="text-xl leading-none">{country.flag}</span>
          <span>{country.code}</span>
          <ChevronDown className="h-4 w-4 text-[color:var(--tara-text-faint)]" />
        </button>
        <div className="flex flex-1 items-center rounded-2xl glass-strong px-4">
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            placeholder={placeholder}
            value={phoneDigits}
            onChange={(event) => {
              setPhone(onlyDigits(event.target.value).slice(0, country.maxDigits));
              setError("");
            }}
            className="w-full bg-transparent py-4 text-base tracking-wider text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:outline-none"
          />
        </div>
      </div>

      {pickerOpen ? (
        <div className="mt-2 overflow-hidden rounded-2xl glass-strong animate-fade-up">
          {COUNTRIES.map((item) => (
            <button
              key={item.code}
              onClick={() => {
                setCountry(item);
                setPhone("");
                setPickerOpen(false);
                setError("");
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[color:var(--tara-text-primary)] transition-colors hover:bg-white/5"
              type="button"
            >
              <span className="text-lg">{item.flag}</span>
              <span className="flex-1">{item.name}</span>
              <span className="text-[color:var(--tara-text-faint)]">{item.code}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const renderOtpInputs = () => (
    <div className="mt-10">
      <div className="flex justify-between gap-2">
        {Array.from({ length: OTP_LENGTH }).map((_, index) => (
          <input
            key={index}
            ref={(element) => {
              otpRefs.current[index] = element;
            }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={otp[index] ?? ""}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => onOtpKeyDown(index, event)}
            onPaste={onOtpPaste}
            disabled={loading}
            aria-label={`Digit ${index + 1}`}
            className={`h-14 w-12 rounded-2xl text-center font-[var(--font-serif)] text-2xl text-[color:var(--tara-text-primary)] transition-all focus:outline-none ${
              error
                ? "border border-rose-300/55 bg-rose-500/10"
                : otp[index]
                  ? "border border-[color:var(--tara-gold)]/70 bg-[color:var(--tara-gold)]/10 shadow-[0_0_20px_rgba(226,181,79,0.25)]"
                  : "glass-strong"
            }`}
          />
        ))}
      </div>

      <div className="mt-6 text-center text-sm text-[color:var(--tara-text-secondary)]">
        {seconds > 0 ? (
          <>
            Resend code in <span className="text-[color:var(--tara-text-primary)]">0:{String(seconds).padStart(2, "0")}</span>
          </>
        ) : (
          <button onClick={resendCode} className="text-[color:var(--tara-gold)]" type="button">
            Resend code
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-[color:var(--tara-text-secondary)]">
        Tip: use <span className="text-[color:var(--tara-gold)]">123456</span> in this demo.
      </p>
    </div>
  );

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-[390px] overflow-hidden bg-cosmic px-6 pb-8 pt-12">
      <div className="star-field pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-glow blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between">
          <button
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full glass"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Logo size={28} />
          <div className="h-10 w-10" />
        </header>

        {mode === "signup" && signupStep === "phone" ? (
          <section className="mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 1 of 3</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              What&apos;s your
              <br />
              <span className="text-aurora italic">number?</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              We&apos;ll send a 6-digit code to confirm it&apos;s you. No spam, ever.
            </p>

            {renderPhoneInput()}

            <p className="mt-4 text-[11px] leading-relaxed text-[color:var(--tara-text-secondary)]">
              By continuing, you agree to Tara&apos;s <span className="text-[color:var(--tara-gold)]">Terms</span> and{" "}
              <span className="text-[color:var(--tara-gold)]">Privacy Policy</span>.
            </p>

            <div className="mt-auto">
              <button
                onClick={onSendCodeSignup}
                disabled={!canUsePhone || loading}
                className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                Send code
              </button>
              <p className="mt-4 text-center text-xs text-[color:var(--tara-text-secondary)]">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-[color:var(--tara-gold)]"
                >
                  Login
                </button>
              </p>
            </div>
          </section>
        ) : null}

        {mode === "signup" && signupStep === "otp" ? (
          <section className="mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 2 of 3</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Enter the
              <br />
              <span className="text-aurora italic">six digits</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              Sent to <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span>.{" "}
              <button type="button" className="text-[color:var(--tara-gold)]" onClick={() => setSignupStep("phone")}>
                Edit
              </button>
            </p>

            {renderOtpInputs()}

            <div className="mt-auto">
              <button
                onClick={onVerifySignupOtp}
                disabled={!canUseOtp || loading}
                className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </div>
          </section>
        ) : null}

        {mode === "signup" && signupStep === "password" ? (
          <section className="mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 3 of 3</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Create your
              <br />
              <span className="text-aurora italic">password</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              You&apos;ll use <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span> + password for login.
            </p>

            <div className="mt-10 rounded-2xl glass-strong px-4 py-3">
              <label className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-[color:var(--tara-text-faint)]">
                Password
              </label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="At least 8 characters"
                className="w-full bg-transparent py-2 text-base text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:outline-none"
              />
            </div>

            <div className="mt-auto">
              <button
                onClick={onCreateAccount}
                disabled={password.trim().length < 8 || loading}
                className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Creating..." : "Create account"}
              </button>
            </div>
          </section>
        ) : null}

        {mode === "login" ? (
          <section className="mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Welcome back</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Sign in with
              <br />
              <span className="text-aurora italic">phone</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              Existing users can login using phone number and password.
            </p>

            {renderPhoneInput("90000 00001")}

            <div className="mt-3 rounded-2xl glass-strong px-4 py-3">
              <label className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-[color:var(--tara-text-faint)]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Enter your password"
                className="w-full bg-transparent py-2 text-base text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="mt-3 self-start text-sm text-[color:var(--tara-gold)]"
            >
              Forgot password?
            </button>

            <div className="mt-auto">
              <button
                onClick={onLogin}
                disabled={!canUsePhone || !password.trim() || loading}
                className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
              <p className="mt-4 text-center text-xs text-[color:var(--tara-text-secondary)]">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-[color:var(--tara-gold)]"
                >
                  Begin your journey
                </button>
              </p>
            </div>
          </section>
        ) : null}

        {mode === "forgot" && forgotStep === "phone" ? (
          <section className="mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 1 of 2</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Reset
              <br />
              <span className="text-aurora italic">password</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              Enter your number and we&apos;ll verify with a 6-digit OTP.
            </p>

            {renderPhoneInput("90000 00001")}

            <div className="mt-auto">
              <button
                onClick={onSendCodeForgot}
                disabled={!canUsePhone || loading}
                className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                Send code
              </button>
            </div>
          </section>
        ) : null}

        {mode === "forgot" && forgotStep === "otp" ? (
          <section className="mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 2 of 2</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Verify and
              <br />
              <span className="text-aurora italic">reset</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              OTP sent to <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span>.
            </p>

            {renderOtpInputs()}

            <div className="mt-6 rounded-2xl glass-strong px-4 py-3">
              <label className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-[color:var(--tara-text-faint)]">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError("");
                }}
                placeholder="At least 8 characters"
                className="w-full bg-transparent py-2 text-base text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:outline-none"
              />
            </div>

            <div className="mt-auto">
              <button
                onClick={onResetPassword}
                disabled={!canUseOtp || newPassword.trim().length < 8 || loading}
                className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {info}
          </p>
        ) : null}
      </div>
    </main>
  );
}
