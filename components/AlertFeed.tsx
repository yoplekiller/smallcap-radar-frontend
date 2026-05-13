"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const LS_KEY  = "smallcap_read_alerts";   // localStorage에 읽은 alert id 저장
const POLL_MS = 5 * 60 * 1000;            // 5분마다 폴링

// ──────────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────────

export type ConditionDetail = {
  type:      string;
  label:     string;
  passed:    boolean;
  value?:    unknown;
  threshold?: unknown;
};

type PricePoint = { price: number; change_pct: number; tracked_at: string };

export type AlertItem = {
  id:                string;
  rule_id:           string;
  rcept_no:          string;
  corp_name:         string;
  stock_code?:       string;
  title:             string;
  comment:           string;
  conditions_detail: ConditionDetail[];
  sent:              boolean;
  triggered_at:      string;
  market_cap_억?:    number | null;
  stock_price?:      number | null;
  price_tracking?:   { d1?: PricePoint; d5?: PricePoint; d10?: PricePoint };
};

// ──────────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────────

export function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function dartUrl(rcept_no: string) {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcept_no}`;
}

export const SEVERITY_STYLE: Record<string, { border: string; icon: string; badge: string }> = {
  danger:      { border: "border-l-red-500",     icon: "🚨", badge: "bg-red-500" },
  warning:     { border: "border-l-orange-500",  icon: "⚠️",  badge: "bg-orange-500" },
  opportunity: { border: "border-l-emerald-500", icon: "💡", badge: "bg-emerald-500" },
};

export function severityFromTitle(title: string) {
  if (title.includes("위험")) return "danger";
  if (title.includes("기회")) return "opportunity";
  return "warning";
}

// ──────────────────────────────────────────────────────────────────
// 개별 알림 카드
// ──────────────────────────────────────────────────────────────────

export function AlertCard({ alert, isNew }: { alert: AlertItem; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  const severity = severityFromTitle(alert.title);
  const style    = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.warning;

  return (
    <div
      className={`border-l-4 ${style.border} bg-gray-800 rounded-r-lg px-3 py-2.5 cursor-pointer select-none`}
      onClick={() => setOpen((v) => !v)}
    >
      {/* 헤더 행 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs leading-none">{style.icon}</span>
            {isNew && (
              <span className="text-[10px] font-bold bg-blue-500 text-white px-1 py-0.5 rounded">NEW</span>
            )}
            <span className="text-xs font-semibold text-white leading-snug">{alert.title}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-400 font-medium">{alert.corp_name}</span>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-xs text-gray-600">{relativeTime(alert.triggered_at)}</span>
          </div>
        </div>
        <span className="text-gray-600 text-xs shrink-0 mt-0.5">{open ? "▲" : "▼"}</span>
      </div>

      {/* 상세 펼침 */}
      {open && (
        <div className="mt-2 space-y-2 text-xs">
          {/* 조건 상세 */}
          <ul className="space-y-0.5">
            {alert.conditions_detail.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-gray-400">
                <span className={c.passed ? "text-green-400" : "text-red-400"}>
                  {c.passed ? "✓" : "✗"}
                </span>
                <span className="leading-snug">{c.label}</span>
              </li>
            ))}
          </ul>

          {/* 판단 이유 */}
          <p className="text-gray-300 leading-relaxed border-t border-gray-700 pt-2">
            {alert.comment}
          </p>

          {/* 주가 성과 추적 */}
          {alert.price_tracking && Object.keys(alert.price_tracking).length > 0 && (
            <div className="border-t border-gray-700 pt-2">
              <p className="text-gray-500 text-[10px] mb-1">알림 후 주가 성과</p>
              <div className="flex gap-2 flex-wrap">
                {(["d1", "d5", "d10"] as const).map((key) => {
                  const pt = alert.price_tracking![key];
                  if (!pt) return null;
                  const up = pt.change_pct >= 0;
                  return (
                    <span
                      key={key}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        up ? "bg-red-900/60 text-red-300" : "bg-blue-900/60 text-blue-300"
                      }`}
                    >
                      {key.toUpperCase()} {up ? "▲" : "▼"}{Math.abs(pt.change_pct).toFixed(1)}%
                    </span>
                  );
                })}
                {alert.stock_price && (
                  <span className="text-[10px] text-gray-600 self-center">
                    기준가 {alert.stock_price.toLocaleString()}원
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 공시 원문 링크 */}
          <a
            href={dartUrl(alert.rcept_no)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-block text-blue-400 hover:text-blue-300 underline"
          >
            공시 원문 보기 →
          </a>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 메인 패널 + 벨 훅 (export)
// ──────────────────────────────────────────────────────────────────

export function useAlertFeed() {
  const [alerts, setAlerts]     = useState<AlertItem[]>([]);
  const [readIds, setReadIds]   = useState<Set<string>>(new Set());
  const [open, setOpen]         = useState(false);
  const panelRef                = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => !readIds.has(a.id)).length;

  const fetchAlerts = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/alerts/history?limit=30`);
      const data = await res.json();
      setAlerts(data.data ?? []);
    } catch {}
  }, []);

  // 초기 로드 + 주기 폴링
  useEffect(() => {
    setReadIds(loadReadIds());
    fetchAlerts();
    const timer = setInterval(fetchAlerts, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  // 패널 열릴 때 모두 읽음 처리
  function handleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        const newIds = new Set([...readIds, ...alerts.map((a) => a.id)]);
        setReadIds(newIds);
        saveReadIds(newIds);
      }
      return next;
    });
  }

  // 패널 외부 클릭 닫기
  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOut);
    return ()  => document.removeEventListener("mousedown", onClickOut);
  }, [open]);

  return { alerts, readIds, unreadCount, open, handleOpen, panelRef, fetchAlerts };
}

export default function AlertFeed() {
  const { alerts, readIds, unreadCount, open, handleOpen, panelRef, fetchAlerts } = useAlertFeed();

  return (
    <div className="relative" ref={panelRef}>
      {/* 알림 텍스트 버튼 */}
      <button
        onClick={handleOpen}
        className="relative flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
        aria-label="알림"
      >
        <span>🔔</span>
        <span>알림</span>
        {unreadCount > 0 && (
          <span className="min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* 패널 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-bold text-white">세력 포착 알림</span>
            <button
              onClick={fetchAlerts}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              새로고침
            </button>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-[70vh] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-500 text-sm">아직 감지된 알림이 없습니다.</p>
                <p className="text-gray-700 text-xs mt-1">
                  규칙 조건 충족 시 여기에 표시됩니다.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {alerts.map((alert) => (
                  <li key={alert.id} className="px-3 py-2">
                    <AlertCard
                      alert={alert}
                      isNew={!readIds.has(alert.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 패널 푸터 */}
          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-800 text-center">
              <span className="text-xs text-gray-600">
                최근 {alerts.length}건 · 15분마다 자동 갱신
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
