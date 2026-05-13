"use client";

import { useEffect, useRef, useState } from "react";
import AlertsTab from "./AlertsTab";

const LS_READ_KEY = "smallcap_read_alerts";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function check() {
      try {
        const r = await fetch(`${API_URL}/alerts/history?limit=50`);
        const data = await r.json();
        const alerts: { id: string }[] = Array.isArray(data) ? data : data.alerts ?? [];
        const read = new Set<string>(JSON.parse(localStorage.getItem(LS_READ_KEY) || "[]"));
        setCount(alerts.filter((a) => !read.has(a.id)).length);
      } catch {
        setCount(0);
      }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return { count, reset: () => setCount(0) };
}

export default function AlertsModal() {
  const [open, setOpen] = useState(false);
  const { count, reset } = useUnreadCount();
  const backdropRef = useRef<HTMLDivElement>(null);

  function openModal() {
    setOpen(true);
    reset();
  }

  // 백드롭 클릭 시 닫기
  function onBackdrop(e: React.MouseEvent) {
    if (e.target === backdropRef.current) setOpen(false);
  }

  return (
    <>
      {/* 벨 버튼 */}
      <button
        onClick={openModal}
        className="relative p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        title="세력 포착 알림"
      >
        <span className="text-lg">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* 모달 */}
      {open && (
        <div
          ref={backdropRef}
          onClick={onBackdrop}
          className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end"
        >
          <div className="bg-gray-950 rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-bold text-white">⚡ 세력 포착</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>
            {/* 컨텐츠 */}
            <div className="overflow-y-auto flex-1 px-2 pb-6">
              <AlertsTab />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
