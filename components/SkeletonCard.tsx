export function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden animate-pulse">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-5 w-28 bg-gray-800 rounded" />
          <div className="h-4 w-12 bg-gray-800 rounded" />
          <div className="h-4 w-20 bg-gray-800 rounded-full" />
          <div className="h-4 w-14 bg-gray-800 rounded-full" />
        </div>
        <div className="h-4 w-6 bg-gray-800 rounded" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
