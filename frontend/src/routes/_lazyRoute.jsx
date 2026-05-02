import { Suspense, lazy } from "react";

import {
  ChatThreadSkeleton,
  ConversationListSkeleton,
  DiscoverSkeleton,
  KundaliSkeleton,
  MatchesSkeleton,
  ProfileSkeleton,
} from "../components/AppSkeletons";

function SkeletonBlock({ className = "" }) {
  return <div className={`tara-skeleton-block ${className}`} />;
}

function GenericPending({ title = "Loading", copy = "Preparing the next screen for you." }) {
  return (
    <main className="tara-page-shell-compact tara-scene-shell px-5 pb-20 pt-8">
      <section className="tara-screen-panel px-5 py-6">
        <p className="tara-kicker">One moment</p>
        <h1 className="tara-type-section mt-2 text-[2.2rem] leading-none">{title}</h1>
        <p className="tara-copy mt-2 max-w-sm">{copy}</p>
        <div className="mt-6 space-y-3">
          <SkeletonBlock className="h-12 rounded-full" />
          <SkeletonBlock className="h-12 rounded-full" />
          <SkeletonBlock className="h-28 rounded-[1.5rem]" />
        </div>
      </section>
    </main>
  );
}

export function RoutePending({ kind = "generic" }) {
  switch (kind) {
    case "discover":
      return (
        <main className="tara-page-shell tara-scene-shell px-5 pb-28 pt-8">
          <header className="tara-screen-intro px-5 py-5">
            <p className="tara-kicker">Alignments</p>
            <SkeletonBlock className="mt-2 h-12 w-44 rounded-full" />
            <SkeletonBlock className="mt-3 h-4 w-56 rounded-full" />
          </header>
          <section className="mt-5">
            <DiscoverSkeleton />
          </section>
        </main>
      );

    case "matches":
      return (
        <main className="tara-page-shell tara-scene-shell px-5 pb-28 pt-8">
          <header className="tara-screen-intro px-5 py-5">
            <p className="tara-kicker">Aligned souls</p>
            <SkeletonBlock className="mt-2 h-12 w-36 rounded-full" />
            <SkeletonBlock className="mt-3 h-4 w-48 rounded-full" />
          </header>
          <MatchesSkeleton />
        </main>
      );

    case "chat-list":
      return (
        <main className="tara-page-shell tara-scene-shell px-5 pb-28 pt-8">
          <header className="tara-screen-intro px-5 py-5">
            <p className="tara-kicker">Whispers</p>
            <SkeletonBlock className="mt-2 h-12 w-52 rounded-full" />
            <SkeletonBlock className="mt-3 h-4 w-56 rounded-full" />
          </header>
          <div className="tara-screen-panel relative mt-4 px-4 py-3">
            <SkeletonBlock className="h-12 rounded-full" />
          </div>
          <ConversationListSkeleton />
        </main>
      );

    case "chat-detail":
      return (
        <main className="tara-page-shell tara-scene-shell flex min-h-[100dvh] flex-col pb-24 pt-4">
          <header className="tara-screen-panel mx-3 flex items-center gap-3 px-4 py-3">
            <SkeletonBlock className="h-[58px] w-[58px] rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-7 w-32 rounded-full" />
              <SkeletonBlock className="h-3 w-20 rounded-full" />
            </div>
            <SkeletonBlock className="h-7 w-16 rounded-full" />
          </header>
          <section className="flex-1 px-4 py-4">
            <ChatThreadSkeleton />
          </section>
          <div className="tara-screen-panel mx-3 mb-3 mt-2 px-3 py-3">
            <div className="mb-3 flex gap-2">
              <SkeletonBlock className="h-10 w-24 rounded-full" />
              <SkeletonBlock className="h-10 w-24 rounded-full" />
              <SkeletonBlock className="h-10 w-24 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-11 flex-1 rounded-full" />
              <SkeletonBlock className="h-11 w-[74px] rounded-full" />
            </div>
          </div>
        </main>
      );

    case "kundali":
      return (
        <main className="tara-page-shell tara-scene-shell px-5 pb-28 pt-8">
          <header className="tara-screen-intro px-5 py-5">
            <p className="tara-kicker">Astral map</p>
            <SkeletonBlock className="mt-2 h-12 w-44 rounded-full" />
            <SkeletonBlock className="mt-3 h-4 w-56 rounded-full" />
          </header>
          <section className="mt-5">
            <KundaliSkeleton />
          </section>
        </main>
      );

    case "profile":
      return (
        <main className="tara-page-shell tara-scene-shell px-5 pb-28 pt-8">
          <section className="mt-2">
            <ProfileSkeleton />
          </section>
        </main>
      );

    case "auth":
      return <GenericPending title="Opening Tara" copy="Bringing your sign-in flow into focus." />;

    case "onboarding":
      return <GenericPending title="Preparing your profile" copy="Getting the next onboarding step ready." />;

    case "match-detail":
      return <GenericPending title="Loading match" copy="Collecting their details and shared spark." />;

    case "stars":
      return <GenericPending title="Gathering today's signals" copy="Pulling your daily recommendations into view." />;

    case "settings":
      return <GenericPending title="Opening settings" copy="Loading your preferences and theme controls." />;

    case "profile-edit":
      return <GenericPending title="Loading editor" copy="Preparing your profile details for editing." />;

    case "welcome":
      return <GenericPending title="Welcoming you" copy="Setting up the next step in your journey." />;

    case "your-vibe":
      return <GenericPending title="Reading your vibe" copy="Bringing your trait summary into focus." />;

    default:
      return <GenericPending />;
  }
}

export function lazyRouteComponent(loader, kind = "generic") {
  const LazyPage = lazy(loader);

  function LazyRouteComponent(props) {
    return (
      <Suspense fallback={<RoutePending kind={kind} />}>
        <LazyPage {...props} />
      </Suspense>
    );
  }

  LazyRouteComponent.displayName = `LazyRouteComponent(${kind})`;
  return LazyRouteComponent;
}
