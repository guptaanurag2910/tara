import { Navigate } from "@tanstack/react-router";

import { useAuth } from "../hooks/useAuth";
import { isOnboardingComplete } from "../services/onboardingStorage";

export function RequireAuth({ children, allowIncompleteOnboarding = false }) {
  const { token, user } = useAuth();
  const onboardingDone = isOnboardingComplete(user?.id);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (!allowIncompleteOnboarding && !onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
