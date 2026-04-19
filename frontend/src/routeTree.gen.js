/* eslint-disable */

// @ts-nocheck

// This file was manually aligned to TanStack file-route output style.

import { Route as rootRouteImport } from "./routes/__root";
import { Route as IndexRouteImport } from "./routes/index";
import { Route as AuthRouteImport } from "./routes/auth";
import { Route as LoginRouteImport } from "./routes/login";
import { Route as WelcomeRouteImport } from "./routes/welcome";
import { Route as OnboardingRouteImport } from "./routes/onboarding";
import { Route as ProfileSetupRouteImport } from "./routes/profile-setup";
import { Route as DiscoverRouteImport } from "./routes/discover";
import { Route as StarsTodayRouteImport } from "./routes/stars-today";
import { Route as KundaliRouteImport } from "./routes/kundali";
import { Route as MatchesRouteImport } from "./routes/matches";
import { Route as MatchesMatchIdRouteImport } from "./routes/matches_.$matchId";
import { Route as ChatRouteImport } from "./routes/chat";
import { Route as ChatMatchIdRouteImport } from "./routes/chat_.$matchId";
import { Route as ProfileRouteImport } from "./routes/profile";
import { Route as ProfileEditRouteImport } from "./routes/profile.edit";
import { Route as ProfileEditSectionRouteImport } from "./routes/profile.edit.$section";
import { Route as SettingsRouteImport } from "./routes/settings";
import { Route as YourVibeRouteImport } from "./routes/your-vibe";

const IndexRoute = IndexRouteImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => rootRouteImport,
});
const AuthRoute = AuthRouteImport.update({
  id: "/auth",
  path: "/auth",
  getParentRoute: () => rootRouteImport,
});
const LoginRoute = LoginRouteImport.update({
  id: "/login",
  path: "/login",
  getParentRoute: () => rootRouteImport,
});
const WelcomeRoute = WelcomeRouteImport.update({
  id: "/welcome",
  path: "/welcome",
  getParentRoute: () => rootRouteImport,
});
const OnboardingRoute = OnboardingRouteImport.update({
  id: "/onboarding",
  path: "/onboarding",
  getParentRoute: () => rootRouteImport,
});
const ProfileSetupRoute = ProfileSetupRouteImport.update({
  id: "/profile-setup",
  path: "/profile-setup",
  getParentRoute: () => rootRouteImport,
});
const DiscoverRoute = DiscoverRouteImport.update({
  id: "/discover",
  path: "/discover",
  getParentRoute: () => rootRouteImport,
});
const StarsTodayRoute = StarsTodayRouteImport.update({
  id: "/stars-today",
  path: "/stars-today",
  getParentRoute: () => rootRouteImport,
});
const KundaliRoute = KundaliRouteImport.update({
  id: "/kundali",
  path: "/kundali",
  getParentRoute: () => rootRouteImport,
});
const MatchesRoute = MatchesRouteImport.update({
  id: "/matches",
  path: "/matches",
  getParentRoute: () => rootRouteImport,
});
const MatchesMatchIdRoute = MatchesMatchIdRouteImport.update({
  id: "/matches_/$matchId",
  path: "/matches/$matchId",
  getParentRoute: () => rootRouteImport,
});
const ChatRoute = ChatRouteImport.update({
  id: "/chat",
  path: "/chat",
  getParentRoute: () => rootRouteImport,
});
const ChatMatchIdRoute = ChatMatchIdRouteImport.update({
  id: "/chat_/$matchId",
  path: "/chat/$matchId",
  getParentRoute: () => rootRouteImport,
});
const ProfileRoute = ProfileRouteImport.update({
  id: "/profile",
  path: "/profile",
  getParentRoute: () => rootRouteImport,
});
const ProfileEditRoute = ProfileEditRouteImport.update({
  id: "/profile.edit",
  path: "/profile/edit",
  getParentRoute: () => rootRouteImport,
});
const ProfileEditSectionRoute = ProfileEditSectionRouteImport.update({
  id: "/profile.edit.$section",
  path: "/profile/edit/$section",
  getParentRoute: () => rootRouteImport,
});
const SettingsRoute = SettingsRouteImport.update({
  id: "/settings",
  path: "/settings",
  getParentRoute: () => rootRouteImport,
});
const YourVibeRoute = YourVibeRouteImport.update({
  id: "/your-vibe",
  path: "/your-vibe",
  getParentRoute: () => rootRouteImport,
});

const rootRouteChildren = {
  IndexRoute,
  AuthRoute,
  LoginRoute,
  WelcomeRoute,
  OnboardingRoute,
  ProfileSetupRoute,
  DiscoverRoute,
  StarsTodayRoute,
  KundaliRoute,
  MatchesRoute,
  MatchesMatchIdRoute,
  ChatRoute,
  ChatMatchIdRoute,
  ProfileRoute,
  ProfileEditRoute,
  ProfileEditSectionRoute,
  SettingsRoute,
  YourVibeRoute,
};

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren);

