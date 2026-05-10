import { useEffect, useRef } from "react";

export function useInfiniteScroll(
  setPage: (fn: (p: number) => number) => void,
  hasMore: boolean
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "200px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [setPage]);

  return sentinelRef;
}
