"use client";

import { useEffect, useState } from "react";

const LS_KEY = "smallcap_theme";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    const dark = saved !== "light";
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_KEY, theme);
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="text-base leading-none p-1 text-gray-400 hover:text-white transition-colors"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
