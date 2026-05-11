"use client";

import { useRef, useState, useCallback } from "react";

const THRESHOLD = 70;
const RESIST = 0.45;

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    pulling.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 5) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      pulling.current = true;
      setPullY(Math.min(dy * RESIST, THRESHOLD + 10));
    }
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullY(0);
    }
    pulling.current = false;
  }, [pullY, refreshing, onRefresh]);

  return { pullY, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}
