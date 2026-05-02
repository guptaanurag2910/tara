function Shimmer({ className = "" }) {
  return <div className={`tara-skeleton-block ${className}`} />;
}

function SkeletonSurface({ kind = "generic", className = "", children }) {
  return (
    <div data-skeleton-kind={kind} className={`tara-skeleton-surface ${className}`}>
      {children}
    </div>
  );
}

export function DiscoverSkeleton() {
  return (
    <div className="relative flex-1">
      <div className="pointer-events-none absolute inset-x-6 top-10 h-40 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--tara-violet)_24%,transparent)_0%,transparent_72%)] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-2 top-2 h-[70vh] max-h-[650px] rounded-[2.5rem] border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg-strong)_60%,transparent)] opacity-55" />

      <SkeletonSurface kind="discovery" className="relative h-[67vh] max-h-[590px] rounded-[2rem] p-4">
        <Shimmer className="h-[54%] rounded-[1.6rem]" />
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Shimmer className="h-9 w-44 rounded-full" />
            <Shimmer className="h-7 w-20 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Shimmer className="h-7 w-20 rounded-full" />
            <Shimmer className="h-7 w-24 rounded-full" />
            <Shimmer className="h-7 w-16 rounded-full" />
          </div>
          <Shimmer className="h-4 w-full rounded-full" />
          <Shimmer className="h-4 w-5/6 rounded-full" />
          <Shimmer className="h-20 w-full rounded-[1.4rem]" />
        </div>
      </SkeletonSurface>
    </div>
  );
}

export function MatchesSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <section>
        <Shimmer className="mb-3 h-3 w-14 rounded-full" />
        <SkeletonSurface kind="matches" className="-mx-1 flex gap-3 overflow-hidden rounded-[1.75rem] px-4 py-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex w-20 shrink-0 flex-col items-center gap-2">
              <Shimmer className="h-20 w-20 rounded-full" />
              <Shimmer className="h-3 w-14 rounded-full" />
            </div>
          ))}
        </SkeletonSurface>
      </section>

      <section className="space-y-3">
        <Shimmer className="h-3 w-20 rounded-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonSurface key={index} kind="matches" className="flex items-center gap-4 rounded-3xl p-3">
            <Shimmer className="h-16 w-16 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Shimmer className="h-6 w-40 rounded-full" />
                <Shimmer className="h-6 w-16 rounded-full" />
              </div>
              <Shimmer className="h-3 w-5/6 rounded-full" />
            </div>
            <Shimmer className="h-4 w-4 rounded-full" />
          </SkeletonSurface>
        ))}
      </section>
    </div>
  );
}

export function ConversationListSkeleton() {
  return (
    <section className="mt-5 space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonSurface key={index} kind="chat-list" className="flex items-center gap-3 rounded-[1.55rem] px-3 py-3">
          <div className="relative">
            <Shimmer className="h-[58px] w-[58px] shrink-0 rounded-full" />
            {index < 2 ? (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[color:var(--tara-gold)]/45" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-6 w-36 rounded-full" />
            <Shimmer className="h-3 w-5/6 rounded-full" />
          </div>
          <Shimmer className="h-3 w-8 rounded-full" />
        </SkeletonSurface>
      ))}
    </section>
  );
}

export function ChatThreadSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <div className="w-[72%] space-y-2">
          <Shimmer className="h-20 rounded-[1.7rem]" />
          <Shimmer className="h-3 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="w-[64%] space-y-2">
          <Shimmer className="ml-auto h-16 rounded-[1.7rem]" />
          <Shimmer className="ml-auto h-3 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="w-[58%] space-y-2">
          <Shimmer className="h-14 rounded-[1.7rem]" />
          <Shimmer className="h-3 w-12 rounded-full" />
        </div>
      </div>
      <SkeletonSurface kind="chat-thread" className="rounded-3xl p-4">
        <Shimmer className="h-4 w-24 rounded-full" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Shimmer className="h-20 rounded-2xl" />
          <Shimmer className="h-20 rounded-2xl" />
        </div>
      </SkeletonSurface>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonSurface kind="profile" className="rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <Shimmer className="h-20 w-20 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Shimmer className="h-10 w-40 rounded-full" />
            <Shimmer className="h-4 w-5/6 rounded-full" />
            <Shimmer className="h-8 w-28 rounded-full" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[color:var(--tara-empty-border)]/70 px-2 py-3">
              <Shimmer className="mx-auto h-8 w-12 rounded-full" />
              <Shimmer className="mx-auto mt-2 h-3 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonSurface>

      <section>
        <Shimmer className="mb-3 h-3 w-20 rounded-full" />
        <SkeletonSurface kind="profile" className="rounded-[1.75rem] p-5">
          <Shimmer className="h-4 w-full rounded-full" />
          <Shimmer className="mt-3 h-4 w-5/6 rounded-full" />
          <Shimmer className="mt-3 h-4 w-2/3 rounded-full" />
        </SkeletonSurface>
      </section>

      <section>
        <Shimmer className="mb-3 h-3 w-16 rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonSurface key={index} kind="profile" className="overflow-hidden rounded-2xl">
              <Shimmer className="h-28 w-full rounded-none" />
            </SkeletonSurface>
          ))}
        </div>
      </section>

      <section>
        <Shimmer className="mb-3 h-3 w-20 rounded-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonSurface key={index} kind="profile" className="flex items-center gap-3 rounded-[1.4rem] px-4 py-3">
              <Shimmer className="h-9 w-9 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Shimmer className="h-3 w-20 rounded-full" />
                <Shimmer className="h-4 w-40 rounded-full" />
              </div>
            </SkeletonSurface>
          ))}
        </div>
      </section>
    </div>
  );
}

export function KundaliSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonSurface kind="kundali" className="rounded-3xl p-5">
        <Shimmer className="h-3 w-24 rounded-full" />
        <Shimmer className="mt-3 h-10 w-40 rounded-full" />
        <Shimmer className="mt-3 h-4 w-5/6 rounded-full" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[color:var(--tara-empty-border)]/70 p-3">
              <Shimmer className="h-3 w-16 rounded-full" />
              <Shimmer className="mt-2 h-4 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonSurface>

      <section className="space-y-3">
        <div>
          <Shimmer className="h-3 w-28 rounded-full" />
          <Shimmer className="mt-2 h-4 w-56 rounded-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonSurface key={index} kind="kundali" className="rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Shimmer className="h-3 w-24 rounded-full" />
                  <Shimmer className="h-5 w-28 rounded-full" />
                </div>
                <Shimmer className="h-10 w-10 rounded-2xl" />
              </div>
              <Shimmer className="mt-4 h-4 w-full rounded-full" />
              <Shimmer className="mt-2 h-4 w-5/6 rounded-full" />
            </SkeletonSurface>
          ))}
        </div>
      </section>

      <SkeletonSurface kind="kundali" className="rounded-3xl p-5">
        <Shimmer className="h-3 w-24 rounded-full" />
        <Shimmer className="mt-3 h-8 w-48 rounded-full" />
        <Shimmer className="mt-3 h-4 w-full rounded-full" />
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
          <Shimmer className="h-64 rounded-3xl" />
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Shimmer key={index} className="h-20 rounded-2xl" />
              ))}
            </div>
            <Shimmer className="h-28 rounded-2xl" />
          </div>
        </div>
      </SkeletonSurface>
    </div>
  );
}
