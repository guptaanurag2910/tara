import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";

import Logo from "../components/tara/Logo";
import { useAuth } from "../hooks/useAuth";
import { getPhoneStatus } from "../services/authService";
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
  const [checkingPhone, setCheckingPhone] = useState(false);

  const otpRefs = useRef([]);

  const phoneDigits = useMemo(
    () => onlyDigits(phone).slice(0, country.maxDigits),
    [phone, country.maxDigits],
  );
  const fullPhone = `${country.code}${phoneDigits}`;
  const canUsePhone = phoneDigits.length >= country.minDigits;
  const canUseOtp = otp.length === OTP_LENGTH;
  const panelClass = "tara-screen-intro tara-scene-header rounded-[2rem] px-5 py-6";

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
      setSignupStep("otp");
      setPickerOpen(false);
      setInfo("New number detected. Verify with OTP to continue.");
    } catch (apiError) {
      setError(apiError?.message || "Could not verify this phone number.");
    } finally {
      setCheckingPhone(false);
    }
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
          className="tara-card-strong flex min-h-[56px] min-w-[116px] items-center gap-2 rounded-2xl px-4 text-base font-medium text-[color:var(--tara-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tara-focus-ring)]"
          type="button"
          aria-label="Select country"
        >
          <span className="text-xl leading-none">{country.flag}</span>
          <span>{country.code}</span>
          <ChevronDown className="h-4 w-4 text-[color:var(--tara-text-faint)]" />
        </button>
        <div className="tara-card-strong flex flex-1 items-center rounded-2xl px-4">
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
            className="tara-inline-field py-4 text-base tracking-wider"
          />
        </div>
      </div>

      {pickerOpen ? (
        <div className="tara-card-strong mt-2 overflow-hidden rounded-2xl animate-fade-up">
          {COUNTRIES.map((item) => (
            <button
              key={item.code}
              onClick={() => {
                setCountry(item);
                setPhone("");
                setPickerOpen(false);
                setError("");
              }}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left text-sm text-[color:var(--tara-text-primary)] transition-colors hover:bg-[color:var(--tara-color-info-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tara-focus-ring)]"
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
            className={`h-14 w-12 rounded-2xl text-center font-[var(--font-serif)] text-2xl text-[color:var(--tara-text-primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tara-focus-ring)] ${
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
          <button onClick={resendCode} className="tara-inline-link text-sm" type="button">
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
    <main className="tara-scene-shell tara-scene-safe tara-scene-safe-top tara-scene-safe-bottom relative mx-auto min-h-[100dvh] w-full max-w-[390px] overflow-hidden bg-cosmic pt-6">
      <div className="star-field pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-glow blur-3xl" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col pb-8">
        <header className="flex items-center justify-between">
          <button
            onClick={onBack}
            aria-label="Back"
            className="tara-icon-button flex h-10 w-10 items-center justify-center"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Logo size={28} />
          <div className="h-10 w-10" />
        </header>

        {mode === "signup" && signupStep === "phone" ? (
          <section className="mt-10 flex flex-1 flex-col animate-fade-up">
            <div className={panelClass}>
              <p className="tara-kicker">Step 1 of 3</p>
              <h1 className="tara-type-hero mt-3 leading-[1.02]">
                Enter your
                <br />
                <span className="text-aurora italic">number?</span>
              </h1>
              <p className="tara-copy mt-3">
                We&apos;ll first check whether this number already has an account. New numbers continue to OTP verification.
              </p>

              {renderPhoneInput()}

              <p className="tara-faint mt-4 leading-relaxed">
                By continuing, you agree to Tara&apos;s <span className="text-[color:var(--tara-gold)]">Terms</span> and{" "}
                <span className="text-[color:var(--tara-gold)]">Privacy Policy</span>.
              </p>
            </div>

            <div className="mt-auto">
              <button
                onClick={onSendCodeSignup}
                disabled={!canUsePhone || loading || checkingPhone}
                className="tara-primary-btn mt-6 flex h-14 w-full items-center justify-center text-base text-white disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {checkingPhone ? "Checking..." : "Continue"}
              </button>
              <p className="mt-4 text-center text-xs text-[color:var(--tara-text-secondary)]">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="tara-inline-link text-xs"
                >
                  Login
                </button>
              </p>
            </div>
          </section>
        ) : null}

        {mode === "signup" && signupStep === "otp" ? (
          <section className="mt-10 flex flex-1 flex-col animate-fade-up">
            <div className={panelClass}>
              <p className="tara-kicker">Step 2 of 3</p>
              <h1 className="tara-type-hero mt-3 leading-[1.02]">
                Enter the
                <br />
                <span className="text-aurora italic">six digits</span>
              </h1>
              <p className="tara-copy mt-3">
                Sent to <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span>.{" "}
                <button type="button" className="tara-inline-link text-sm" onClick={() => setSignupStep("phone")}>
                  Edit
                </button>
              </p>

              {renderOtpInputs()}
            </div>

            <div className="mt-auto">
              <button
                onClick={onVerifySignupOtp}
                disabled={!canUseOtp || loading}
                className="tara-primary-btn mt-6 flex h-14 w-full items-center justify-center text-base text-white disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </div>
          </section>
        ) : null}

        {mode === "signup" && signupStep === "password" ? (
          <section className="mt-10 flex flex-1 flex-col animate-fade-up">
            <div className={panelClass}>
              <p className="tara-kicker">Step 3 of 3</p>
              <h1 className="tara-type-hero mt-3 leading-[1.02]">
                Create your
                <br />
                <span className="text-aurora italic">password</span>
              </h1>
              <p className="tara-copy mt-3">
                You&apos;ll use <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span> + password for login.
              </p>

              <div className="tara-screen-panel mt-10 px-4 py-3">
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
                  className="tara-inline-field py-2 text-base"
                />
              </div>
            </div>

            <div className="mt-auto">
              <button
                onClick={onCreateAccount}
                disabled={password.trim().length < 8 || loading}
                className="tara-primary-btn mt-6 flex h-14 w-full items-center justify-center text-base text-white disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Creating..." : "Create account"}
              </button>
            </div>
          </section>
        ) : null}

        {mode === "login" ? (
          <section className="mt-10 flex flex-1 flex-col animate-fade-up">
            <div className={panelClass}>
              <p className="tara-kicker">Welcome back</p>
              <h1 className="tara-type-hero mt-3 leading-[1.02]">
                Login with
                <br />
                <span className="text-aurora italic">phone</span>
              </h1>
              <p className="tara-copy mt-3">
                Existing users only need their phone number and password.
              </p>

              {renderPhoneInput("90000 00001")}

              <div className="tara-screen-panel mt-3 px-4 py-3">
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
                  className="tara-inline-field py-2 text-base"
                />
              </div>

              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="tara-inline-link mt-3 self-start text-sm"
              >
                Forgot password?
              </button>

              {mode === "login" && /incorrect password/i.test(error) ? (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="tara-inline-link mt-2 self-start text-sm"
                >
                  Reset password instead
                </button>
              ) : null}

              {mode === "login" && /no account found/i.test(error) ? (
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="tara-inline-link mt-2 self-start text-sm"
                >
                  Create a new account
                </button>
              ) : null}
            </div>
            <div className="mt-auto">
              <button
                onClick={onLogin}
                disabled={!canUsePhone || !password.trim() || loading}
                className="tara-primary-btn mt-6 flex h-14 w-full items-center justify-center text-base text-white disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
              <p className="mt-4 text-center text-xs text-[color:var(--tara-text-secondary)]">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="tara-inline-link text-xs"
                >
                  Begin your journey
                </button>
              </p>
            </div>
          </section>
        ) : null}

        {mode === "forgot" && forgotStep === "phone" ? (
          <section className="mt-10 flex flex-1 flex-col animate-fade-up">
            <div className={panelClass}>
              <p className="tara-kicker">Step 1 of 2</p>
              <h1 className="tara-type-hero mt-3 leading-[1.02]">
                Reset
                <br />
                <span className="text-aurora italic">password</span>
              </h1>
              <p className="tara-copy mt-3">
                Enter your number and we&apos;ll verify with a 6-digit OTP.
              </p>

              {renderPhoneInput("90000 00001")}
            </div>

            <div className="mt-auto">
              <button
                onClick={onSendCodeForgot}
                disabled={!canUsePhone || loading}
                className="tara-primary-btn mt-6 flex h-14 w-full items-center justify-center text-base text-white disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {mode === "forgot" && forgotStep === "otp" ? (
          <section className="mt-10 flex flex-1 flex-col animate-fade-up">
            <div className={panelClass}>
              <p className="tara-kicker">Step 2 of 2</p>
              <h1 className="tara-type-hero mt-3 leading-[1.02]">
                Verify and
                <br />
                <span className="text-aurora italic">reset</span>
              </h1>
              <p className="tara-copy mt-3">
                OTP sent to <span className="text-[color:var(--tara-text-primary)]">{fullPhone}</span>.
              </p>

              {renderOtpInputs()}

              <div className="tara-screen-panel mt-6 px-4 py-3">
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
                  className="tara-inline-field py-2 text-base"
                />
              </div>
            </div>

            <div className="mt-auto">
              <button
                onClick={onResetPassword}
                disabled={!canUseOtp || newPassword.trim().length < 8 || loading}
                className="tara-primary-btn mt-6 flex h-14 w-full items-center justify-center text-base text-white disabled:opacity-40 disabled:shadow-none"
                type="button"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="tara-alert tara-alert-error mt-4">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="tara-alert tara-alert-success mt-4">
            {info}
          </p>
        ) : null}
      </div>
    </main>
  );
}
