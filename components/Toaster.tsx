"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType };

let _id = 0;

export function toast(message: string, type: ToastType = "info") {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("app:toast", { detail: { message, type } }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = ++_id;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3000);
    }
    document.addEventListener("app:toast", handler);
    return () => document.removeEventListener("app:toast", handler);
  }, []);

  if (!items.length) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-sm w-full px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 animate-fade-in ${
            t.type === "success"
              ? "bg-emerald-700"
              : t.type === "error"
              ? "bg-red-700"
              : "bg-gray-700"
          }`}
        >
          <span className="shrink-0">
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
