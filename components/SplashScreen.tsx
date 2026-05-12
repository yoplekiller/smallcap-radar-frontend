"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1500);
    const hideTimer = setTimeout(() => setHidden(true), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gray-950 transition-opacity duration-600 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl mb-2">📡</div>
        <h1 className="text-2xl font-bold text-blue-400 tracking-tight">소형주 공시 레이더</h1>
        <p className="text-sm text-gray-500">실시간 공시 · AI 분석 · 세력 포착</p>
      </div>
      <div className="absolute bottom-14 flex flex-col items-center gap-2">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
