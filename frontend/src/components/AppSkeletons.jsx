function Shimmer({ className = "" }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />;
}

export function DiscoverSkeleton() {
  return (
    <div className="relative flex-1">
      <div className="h-[67vh] max-h-[590px] rounded-[2rem] border border-white/10 bg-slate-900/55 p-4 shadow-xl shadow-black/20">
        <Shimmer className="h-[54%] rounded-[1.6rem]" />
        <div className="mt-4 space-y-3">
          <Shimmer className="h-8 w-40 rounded-full" />
          <div className="flex gap-2">
            <Shimmer className="h-7 w-20 rounded-full" />
            <Shimmer className="h-7 w-20 rounded-full" />
            <Shimmer className="h-7 w-24 rounded-full" />
          </div>
          <Shimmer className="h-4 w-full rounded-full" />
          <Shimmer className="h-4 w-5/6 rounded-full" />
          <Shimmer className="h-20 w-full rounded-[1.4rem]" />
        </div>
      </div>
    </div>
  );
}

export function MatchesSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <section>
        <Shimmer className="mb-3 h-3 w-16 rounded-full" />
        <div className="-mx-5 flex gap-3 overflow-hidden px-5 pb-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex w-20 shrink-0 flex-col items-center gap-2">
              <Shimmer className="h-20 w-20 rounded-full" />
              <Shimmer className="h-3 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Shimmer className="h-3 w-20 rounded-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-3">
            <Shimmer className="h-16 w-16 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Shimmer className="h-5 w-40 rounded-full" />
              <Shimmer className="h-3 w-5/6 rounded-full" />
            </div>
            <Shimmer className="h-4 w-10 rounded-full" />
          </div>
        ))}
      </section>
    </div>
  );
}

export function ConversationListSkeleton() {
  return (
    <section className="mt-5 space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl px-1 py-2">
          <Shimmer className="h-[58px] w-[58px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-5 w-36 rounded-full" />
            <Shimmer className="h-3 w-5/6 rounded-full" />
          </div>
          <Shimmer className="h-3 w-8 rounded-full" />
        </div>
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
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <Shimmer className="h-4 w-24 rounded-full" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Shimmer className="h-20 rounded-2xl" />
          <Shimmer className="h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
