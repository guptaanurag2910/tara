import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import BottomNav from "./components/tara/BottomNav";
import { useAuth } from "./hooks/useAuth";
import Chat from "./pages/Chat";
import DailyMatches from "./pages/DailyMatches";
import Discover from "./pages/Discover";
import EditProfile from "./pages/EditProfile";
import EditProfileSection from "./pages/EditProfileSection";
import Kundali from "./pages/Kundali";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import MatchDetail from "./pages/MatchDetail";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import ProfileSetup from "./pages/ProfileSetup";
import Settings from "./pages/Settings";
import WelcomeTransition from "./pages/WelcomeTransition";
import YourVibe from "./pages/YourVibe";
import { isOnboardingComplete } from "./services/onboardingStorage";

function RequireAuth({ children, allowIncompleteOnboarding = false }) {
  const { token, user } = useAuth();
  const location = useLocation();
  const onboardingDone = isOnboardingComplete(user?.id);

  if (!token) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (!allowIncompleteOnboarding && !onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export default function App() {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-app pb-[calc(7rem+env(safe-area-inset-bottom))] text-[color:var(--tara-text-primary)]">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />

        <Route
          path="/welcome"
          element={
            <RequireAuth allowIncompleteOnboarding>
              <WelcomeTransition />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding"
          element={
            <RequireAuth allowIncompleteOnboarding>
              <ProfileSetup />
            </RequireAuth>
          }
        />
        <Route
          path="/profile-setup"
          element={
            <RequireAuth allowIncompleteOnboarding>
              <ProfileSetup />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <RequireAuth>
              <EditProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit/:section"
          element={
            <RequireAuth>
              <EditProfileSection />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/your-vibe"
          element={
            <RequireAuth>
              <YourVibe />
            </RequireAuth>
          }
        />

        <Route
          path="/discover"
          element={
            <RequireAuth>
              <Discover />
            </RequireAuth>
          }
        />
        <Route
          path="/stars-today"
          element={
            <RequireAuth>
              <DailyMatches />
            </RequireAuth>
          }
        />
        <Route
          path="/kundali"
          element={
            <RequireAuth>
              <Kundali />
            </RequireAuth>
          }
        />
        <Route
          path="/matches"
          element={
            <RequireAuth>
              <Matches />
            </RequireAuth>
          }
        />
        <Route
          path="/matches/:matchId"
          element={
            <RequireAuth>
              <MatchDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
        <Route
          path="/chat/:matchId"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
