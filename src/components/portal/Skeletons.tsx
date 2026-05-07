/**
 * Section-shaped skeletons used as Suspense fallbacks while server
 * components fetch data. These render instantly so the user sees the
 * page shape immediately instead of a blank area.
 */

export function CardSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl border border-gray-200/70 bg-white ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]"
      style={{ height }}
    />
  );
}

export function SectionSkeleton({
  title,
  description,
  bodyHeight = 280,
}: {
  title?: string;
  description?: string;
  bodyHeight?: number;
}) {
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          {title ? (
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {title}
            </h2>
          ) : (
            <div className="h-6 w-48 animate-pulse rounded-md bg-gray-200/70 dark:bg-white/5" />
          )}
          {description ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          ) : (
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-200/60 dark:bg-white/5" />
          )}
        </div>
      </div>
      <CardSkeleton height={bodyHeight} />
    </section>
  );
}

export function KPIGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200/70 bg-white p-5 ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]"
        >
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200/70 dark:bg-white/5" />
          <div className="mt-3 h-8 w-24 animate-pulse rounded bg-gray-200/70 dark:bg-white/10" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-200/50 dark:bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function FunnelCardSkeleton() {
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="h-6 w-64 animate-pulse rounded-md bg-gray-200/70 dark:bg-white/5" />
          <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-200/60 dark:bg-white/5" />
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]">
        <div className="mb-5 flex gap-3 border-b border-gray-200/70 pb-4 dark:border-white/5">
          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200/70 dark:bg-white/5" />
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200/70 dark:bg-white/5" />
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200/70 dark:bg-white/5" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-3 w-16 animate-pulse rounded bg-gray-200/70 dark:bg-white/5" />
              <div className="mt-2 h-7 w-20 animate-pulse rounded bg-gray-200/70 dark:bg-white/10" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-3">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200/70 dark:bg-white/5" />
                <div className="mt-1 h-3 w-20 animate-pulse rounded bg-gray-200/50 dark:bg-white/5" />
              </div>
              <div className="col-span-6">
                <div className="h-7 w-full animate-pulse rounded-md bg-gray-200/60 dark:bg-white/5" />
              </div>
              <div className="col-span-3 text-right">
                <div className="ml-auto h-5 w-16 animate-pulse rounded bg-gray-200/70 dark:bg-white/5" />
                <div className="ml-auto mt-1 h-3 w-24 animate-pulse rounded bg-gray-200/50 dark:bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-4 ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `2fr ${"1fr ".repeat(cols - 1)}` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 animate-pulse rounded bg-gray-200/60 dark:bg-white/5"
                style={{ animationDelay: `${(r + c) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
