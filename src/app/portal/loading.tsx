/**
 * Skeleton shown while a /portal/* route is server-rendering.
 * Next.js renders this instantly on link click — makes navigation feel snappy
 * while the server fetches Keap/Thinkific/GA4/WP data.
 */
export default function PortalLoading() {
  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-baseline justify-between">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-gray-200/70 dark:bg-white/5" />
          <div className="h-7 w-44 animate-pulse rounded-lg bg-gray-200/70 dark:bg-white/5" />
        </div>
        <div className="mt-3 h-5 w-96 animate-pulse rounded-md bg-gray-200/60 dark:bg-white/5" />
      </div>

      {/* KPI strip */}
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
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

      {/* Tabs skeleton */}
      <div className="mb-8 flex gap-3 border-b border-gray-200/70 dark:border-white/5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="my-2 h-7 w-24 animate-pulse rounded-md bg-gray-200/70 dark:bg-white/5"
          />
        ))}
      </div>

      {/* Body */}
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-2xl border border-gray-200/70 bg-white ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]" />
        <div className="h-72 animate-pulse rounded-2xl border border-gray-200/70 bg-white ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]" />
        <div className="h-56 animate-pulse rounded-2xl border border-gray-200/70 bg-white ring-1 ring-black/[0.03] dark:border-white/5 dark:bg-[#1f1f22] dark:ring-white/[0.04]" />
      </div>

      {/* Subtle pulse caption */}
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-blue opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" />
        </span>
        Fetching live data from Keap, Thinkific, and GA4…
      </div>
    </main>
  );
}
