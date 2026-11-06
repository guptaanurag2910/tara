import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Eye, EyeOff } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { getPhoneStatus, sendPhoneOtp, verifyPhoneOtp } from "../services/authService";
import { isOnboardingComplete } from "../services/onboardingStorage";

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
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [pendingAuthDestination, setPendingAuthDestination] = useState(null);

  const otpRefs = useRef([]);

  const phoneDigits = useMemo(
    () => onlyDigits(phone).slice(0, country.maxDigits),
    [phone, country.maxDigits],
  );
  const fullPhone = `${country.code}${phoneDigits}`;
  const canUsePhone = phoneDigits.length >= country.minDigits;
  const canUseOtp = otp.length === OTP_LENGTH;

  useEffect(() => {
    if (!pendingAuthDestination || !token || !user) {
      return;
    }
    navigate(pendingAuthDestination === "signup" ? "/welcome" : isOnboardingComplete(user.id) ? "/discover" : "/onboarding", { replace: true });
  }, [navigate, pendingAuthDestination, token, user]);

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
    setDevelopmentCode("");
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

  const onSendCodeSignup = async () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
      return;
    }
    try {
      setCheckingPhone(true);
      const response = await getPhoneStatus({ phone_number: fullPhone });

      if (response?.exists) {
        switchMode("login");
        setInfo("This number already has an account. Enter your password to log in.");
        return;
      }

      setOtp("");
      setSeconds(RESEND_SECONDS);
      const delivery = await sendPhoneOtp({ phone_number: fullPhone, purpose: "signup" });
      setDevelopmentCode(delivery.development_code || "");
      setSignupStep("otp");
      setPickerOpen(false);
      setInfo(delivery.development_code ? `Development code: ${delivery.development_code} · No SMS was sent.` : "Verification code sent. Check your SMS messages.");
    } catch (apiError) {
      setError(apiError?.message || "Could not verify this phone number.");
    } finally {
      setCheckingPhone(false);
    }
  };

  const onVerifySignupOtp = async () => {
    resetMessages();
    if (!canUseOtp) {
      return;
    }
    try {
      await verifyPhoneOtp({ phone_number: fullPhone, purpose: "signup", otp });
      setSignupStep("password");
    } catch (apiError) { setError(apiError?.message || "That code is incorrect or expired."); }
  };

  const onCreateAccount = async () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!dateOfBirth) {
      setError("Enter your date of birth to confirm you are 18 or older.");
      return;
    }
    const birth = new Date(`${dateOfBirth}T00:00:00`);
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18);
    if (birth > cutoff) {
      setError("Tara is for adults aged 18 and over.");
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
        date_of_birth: dateOfBirth,
        name: `Tara ${phoneDigits.slice(-4)}`,
      });
      setPendingAuthDestination("signup");
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
      setPendingAuthDestination("login");
    } catch (apiError) {
      const message = apiError?.message || "Login failed.";

      if (/invalid phone number or password/i.test(message)) {
        try {
          const response = await getPhoneStatus({ phone_number: fullPhone });
          if (response?.exists) {
            setError("Incorrect password. Reset it if you've forgotten it.");
            return;
          }
          setError("No account found for this number. Create an account to continue.");
          return;
        } catch (statusError) {
          setError(statusError?.message || message);
          return;
        }
      }

      setError(message);
    }
  };

  const onSendCodeForgot = async () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
      return;
    }
    try {
      const delivery = await sendPhoneOtp({ phone_number: fullPhone, purpose: "password_reset" });
      setDevelopmentCode(delivery.development_code || "");
      setOtp(""); setNewPassword(""); setShowNewPassword(false); setSeconds(RESEND_SECONDS); setForgotStep("otp"); setPickerOpen(false);
      setInfo(delivery.development_code ? `Development code: ${delivery.development_code} · No SMS was sent.` : "Verification code sent. Check your SMS messages.");
    } catch (apiError) { setError(apiError?.message || "Could not send a verification code."); }
  };

  const onResetPassword = async () => {
    resetMessages();
    if (!canUsePhone) {
      setError("Enter a valid phone number.");
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

  const resendCode = async () => {
    if (seconds > 0) {
      return;
    }
    try {
      const delivery = await sendPhoneOtp({ phone_number: fullPhone, purpose: mode === "signup" ? "signup" : "password_reset" });
      setDevelopmentCode(delivery.development_code || ""); setOtp(""); setSeconds(RESEND_SECONDS); setError("");
      setInfo(delivery.development_code ? `Development code: ${delivery.development_code} · No SMS was sent.` : "A new verification code was sent.");
      otpRefs.current[0]?.focus();
    } catch (apiError) { setError(apiError?.message || "Could not resend the verification code."); }
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
            className={`auth-otp-input ${error ? "is-error" : otp[index] ? "is-filled" : ""}`}
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
        {developmentCode ? <>Development OTP: <span className="text-[color:var(--tara-gold)]">{developmentCode}</span>. No SMS was sent.</> : "Enter the code sent to your phone."}
      </p>
    </div>
  );

  return (
    <main className="tara-container tara-onboarding tara-entry tara-auth">
      <div className="entry-body">
        <header className="entry-header auth-header">
          <button
            onClick={onBack}
            aria-label="Back"
            className="tara-back-btn"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="onboarding-brand">tara<span className="onboarding-brand-dot">.</span></span>
          <div className="h-9 w-9" />
        </header>
        {mode === "signup" || mode === "forgot" ? (
          <div aria-label={mode === "forgot" ? "Password reset progress" : "Sign-up progress"} className="tara-progress-track auth-progress" role="progressbar" aria-valuenow={mode === "forgot" ? forgotStep === "phone" ? 1 : 2 : signupStep === "phone" ? 1 : signupStep === "otp" ? 2 : 3} aria-valuemin={0} aria-valuemax={mode === "forgot" ? 2 : 3}>
            <div className="tara-progress-fill h-full transition-all duration-300" style={{ width: mode === "forgot" ? forgotStep === "phone" ? "50%" : "100%" : signupStep === "phone" ? "33.33%" : signupStep === "otp" ? "66.67%" : "100%" }} />
          </div>
        ) : null}

        {mode === "signup" && signupStep === "phone" ? (
          <section className="mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 1 of 3</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Enter your
              <br />
              <span className="onboarding-accent-text">number?</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              We&apos;ll first check whether this number already has an account. New numbers continue to OTP verification.
            </p>

            {renderPhoneInput()}

            <p className="mt-4 text-[11px] leading-relaxed text-[color:var(--tara-text-secondary)]">
              By continuing, you agree to Tara&apos;s <span className="text-[color:var(--tara-gold)]">Terms</span> and{" "}
              <span className="text-[color:var(--tara-gold)]">Privacy Policy</span>.
            </p>

            <div className="mt-auto">
              <button
                onClick={onSendCodeSignup}
                disabled={!canUsePhone || loading || checkingPhone}
                className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {checkingPhone ? "Checking..." : "Continue"}
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
              <span className="onboarding-accent-text">six digits</span>
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
              <span className="onboarding-accent-text">password</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              You&apos;ll use <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span> + password for login.
            </p>

            <div className="mt-8 rounded-2xl glass-strong px-4 py-3">
              <label className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-[color:var(--tara-text-faint)]" htmlFor="signup-date-of-birth">Date of birth · 18+ only</label>
              <input id="signup-date-of-birth" aria-label="Date of birth" type="date" max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })()} value={dateOfBirth} onChange={(event) => { setDateOfBirth(event.target.value); setError(""); }} className="w-full bg-transparent py-2 text-base text-[color:var(--tara-text-primary)] focus:outline-none" />
              <p className="text-xs text-[color:var(--tara-text-faint)]">Your full birth date stays private.</p>
            </div>

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
                disabled={password.trim().length < 8 || !dateOfBirth || loading}
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
              Login with
              <br />
              <span className="onboarding-accent-text">phone</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              Existing users only need their phone number and password.
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

            {mode === "login" && /incorrect password/i.test(error) ? (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="mt-2 self-start text-sm text-[color:var(--tara-gold)]"
              >
                Reset password instead
              </button>
            ) : null}

            {mode === "login" && /no account found/i.test(error) ? (
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="mt-2 self-start text-sm text-[color:var(--tara-gold)]"
              >
                Create a new account
              </button>
            ) : null}

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
          <section className="auth-reset-step mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 1 of 2</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Reset
              <br />
              <span className="onboarding-accent-text">password</span>
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
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {mode === "forgot" && forgotStep === "otp" ? (
          <section className="auth-reset-step mt-12 flex flex-1 flex-col animate-fade-up">
            <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--tara-gold)]">Step 2 of 2</p>
            <h1 className="tara-heading mt-3 text-6xl leading-tight">
              Verify and
              <br />
              <span className="onboarding-accent-text">reset</span>
            </h1>
            <p className="mt-3 text-[15px] text-[color:var(--tara-text-secondary)]">
              OTP sent to <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span>.{" "}
              <button className="auth-reset-edit-phone" onClick={() => setForgotStep("phone")} type="button">Edit number</button>
            </p>

            {renderOtpInputs()}

            <div className="auth-reset-password mt-6 rounded-2xl glass-strong px-4 py-3">
              <label className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-[color:var(--tara-text-faint)]">
                New password
              </label>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError("");
                }}
                placeholder="At least 8 characters"
                className="w-full bg-transparent py-2 text-base text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:outline-none"
              />
              <button aria-label={showNewPassword ? "Hide password" : "Show password"} onClick={() => setShowNewPassword((visible) => !visible)} type="button">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
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
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </p>
        ) : null}
      </div>
    </main>
  );
}
