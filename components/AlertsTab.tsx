"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertItem,
  AlertCard,
  SEVERITY_STYLE,
  severityFromTitle,
  relativeTime,
  loadReadIds,
  saveReadIds,
} from "./AlertFeed";
import NotificationSettingsModal, { loadPrefs, type NotifPrefs } from "./NotificationSettingsModal";
import { type PortfolioItem } from "./PortfolioTab";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
const PORTFOLIO_LS_KEY = "smallcap_portfolio";
const LS_PINNED_KEY = "smallcap_alert_pinned";

type SeverityFilter = "all" | "danger" | "opportunity";
type SortOrder = "latest" | "oldest";
type StockFilter = "all" | "small_cap" | "penny";

type AlertGroup = {
  corp_name: string;
  alerts: AlertItem[];
  latestAt: string;
};

const FILTER_STYLES: Record<SeverityFilter, { active: string; inactive: string; label: string }> = {
  all:         { active: "bg-gray-700 border-gray-500 text-white",             inactive: "border-gray-700 text-gray-500", label: "전체" },
  danger:      { active: "bg-red-900 border-red-600 text-red-200",             inactive: "border-gray-700 text-gray-500", label: "위험" },
  opportunity: { active: "bg-emerald-900 border-emerald-600 text-emerald-200", inactive: "border-gray-700 text-gray-500", label: "기회" },
};

const STOCK_FILTER_OPTIONS: { key: StockFilter; label: string; desc: string }[] = [
  { key: "all",       label: "전체",  desc: "" },
  { key: "small_cap", label: "소형주", desc: "시총 3,000억 이하" },
  { key: "penny",     label: "동전주", desc: "주가 1,000원 이하" },
];

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_PINNED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function savePinned(pinned: Set<string>) {
  try {
    localStorage.setItem(LS_PINNED_KEY, JSON.stringify([...pinned]));
  } catch {}
}

function groupByCompany(alerts: AlertItem[]): AlertGroup[] {
  const map = new Map<string, AlertItem[]>();
  for (const a of alerts) {
    const key = a.corp_name || "기타";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return [...map.entries()].map(([corp_name, items]) => ({
    corp_name,
    alerts: items,
    latestAt: items[0].triggered_at,
  }));
}

function CompanyAlertCard({
  group,
  readIds,
  isPinned,
  onTogglePin,
}: {
  group: AlertGroup;
  readIds: Set<string>;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasNew = group.alerts.some((a) => !readIds.has(a.id));
  const severities = [...new Set(group.alerts.map((a) => severityFromTitle(a.title)))];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white">{group.corp_name}</span>
          {hasNew && (
            <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">NEW</span>
          )}
          {severities.map((sev) => {
            const style = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.warning;
            return (
              <span key={sev} className="text-sm leading-none">{style.icon}</span>
            );
          })}
          <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-0.5 rounded-full">
            알림 {group.alerts.length}건
          </span>
          <span className="text-xs text-gray-600">{relativeTime(group.latestAt)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className={`text-base leading-none transition-colors ${
              isPinned ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400"
            }`}
            aria-label={isPinned ? "관심 해제" : "관심 등록"}
          >
            {isPinned ? "★" : "☆"}
          </button>
          <span className="text-gray-500 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60 px-3 py-2 space-y-2">
          {group.alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isNew={!readIds.has(alert.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function loadPortfolioCodes(): Set<string> {
  try {
    const raw = localStorage.getItem(PORTFOLIO_LS_KEY);
    const items: PortfolioItem[] = raw ? JSON.parse(raw) : [];
    return new Set(items.map((i) => i.corp_name));
  } catch {
    return new Set();
  }
}

const NOTIF_KEYWORD_MAP: Array<{ key: keyof NotifPrefs; keywords: string[] }> = [
  { key: "cb",         keywords: ["전환사채"] },
  { key: "rights",     keywords: ["유상증자"] },
  { key: "treasury",   keywords: ["자기주식"] },
  { key: "major",      keywords: ["주요사항"] },
  { key: "governance", keywords: ["대량보유", "임원", "주요주주"] },
];

export default function AlertsTab() {
  const [alerts, setAlerts]           = useState<AlertItem[]>([]);
  const [loading, setLoading]         = useState(false);
  const [readIds, setReadIds]         = useState<Set<string>>(new Set());
  const [pinned, setPinned]           = useState<Set<string>>(new Set());
  const [pinnedOnly, setPinnedOnly]   = useState(false);
  const [filter, setFilter]           = useState<SeverityFilter>("all");
  const [sortOrder, setSortOrder]     = useState<SortOrder>("latest");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [stockOpen, setStockOpen]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifPrefs, setNotifPrefs]   = useState<NotifPrefs | null>(null);
  const stockRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/alerts/history?limit=200`);
      const data = await res.json();
      const items: AlertItem[] = data.data ?? [];
      setAlerts(items);
      setReadIds((prev) => {
        const next = new Set([...prev, ...items.map((a) => a.id)]);
        saveReadIds(next);
        return next;
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setReadIds(loadReadIds());
    setPinned(loadPinned());
    setNotifPrefs(loadPrefs());
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (stockRef.current && !stockRef.current.contains(e.target as Node)) {
        setStockOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function togglePin(corp_name: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(corp_name)) next.delete(corp_name);
      else next.add(corp_name);
      savePinned(next);
      return next;
    });
  }

  // 알림 설정 기반 필터링
  let filtered = alerts;
  if (notifPrefs) {
    const prefs = notifPrefs;
    filtered = filtered.filter((a) => {
      const title = a.title ?? "";
      for (const { key, keywords } of NOTIF_KEYWORD_MAP) {
        if (!prefs[key] && keywords.some((kw) => title.includes(kw))) return false;
      }
      return true;
    });
    if (prefs.portfolioOnly) {
      const portfolioCodes = loadPortfolioCodes();
      if (portfolioCodes.size > 0) {
        filtered = filtered.filter((a) => portfolioCodes.has(a.corp_name));
      }
    }
    if (prefs.smallCapOnly) {
      filtered = filtered.filter((a) => a.market_cap_억 != null && a.market_cap_억 <= 3000);
    }
  }

  // 심각도 필터
  if (filter !== "all") {
    filtered = filtered.filter((a) => severityFromTitle(a.title) === filter);
  }

  if (stockFilter === "small_cap") {
    filtered = filtered.filter((a) => a.market_cap_억 != null && a.market_cap_억 <= 3000);
  } else if (stockFilter === "penny") {
    filtered = filtered.filter((a) => a.stock_price != null && a.stock_price < 1000);
  }

  // 그룹화 → 관심 필터 → 정렬
  let groups = groupByCompany(filtered);
  if (pinnedOnly) {
    groups = groups.filter((g) => pinned.has(g.corp_name));
  }
  if (sortOrder === "oldest") {
    groups = groups.reverse();
  }

  const dangerCount      = alerts.filter((a) => severityFromTitle(a.title) === "danger").length;
  const opportunityCount = alerts.filter((a) => severityFromTitle(a.title) === "opportunity").length;

  const countMap: Record<SeverityFilter, number> = {
    all:         alerts.length,
    danger:      dangerCount,
    opportunity: opportunityCount,
  };

  const selectedStockLabel = STOCK_FILTER_OPTIONS.find((o) => o.key === stockFilter)?.label ?? "전체";

  return (
    <>
      <NotificationSettingsModal
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); setNotifPrefs(loadPrefs()); }}
      />

      {/* 상단 바 */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">위험·기회 알림 이력 · 15분마다 자동 갱신</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
            title="알림 설정"
          >
            ⚙ 설정
          </button>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600"
          >
            {loading ? "..." : "새로고침"}
          </button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* 심각도 필터 */}
        {(["all", "danger", "opportunity"] as SeverityFilter[]).map((key) => {
          const s   = FILTER_STYLES[key];
          const cnt = countMap[key];
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filter === key ? s.active : s.inactive
              }`}
            >
              {key === "danger" ? "🚨 " : key === "opportunity" ? "💡 " : ""}
              {s.label}
              {cnt > 0 && <span className="ml-1 opacity-80">({cnt})</span>}
            </button>
          );
        })}

        <span className="text-gray-700 text-xs">|</span>

        {/* 관심만 보기 토글 */}
        <button
          onClick={() => setPinnedOnly((v) => !v)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            pinnedOnly
              ? "bg-yellow-900/50 border-yellow-600 text-yellow-300"
              : "border-gray-700 text-gray-400 hover:text-gray-200"
          }`}
        >
          {pinnedOnly ? "★ 관심" : "☆ 관심"}
          {pinned.size > 0 && <span className="ml-1 opacity-70">({pinned.size})</span>}
        </button>

        {/* 정렬 토글 */}
        <button
          onClick={() => setSortOrder((p) => p === "latest" ? "oldest" : "latest")}
          className="px-3 py-1 text-xs rounded-full border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
        >
          {sortOrder === "latest" ? "최신순 ↓" : "오래된순 ↑"}
        </button>

        {/* 종목 필터 드롭다운 */}
        <div className="relative" ref={stockRef}>
          <button
            onClick={() => setStockOpen((v) => !v)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors flex items-center gap-1 ${
              stockFilter !== "all"
                ? "bg-blue-900 border-blue-600 text-blue-300"
                : "border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {selectedStockLabel} ▾
          </button>
          {stockOpen && (
            <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 w-36 py-1">
              {STOCK_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setStockFilter(opt.key); setStockOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    stockFilter === opt.key
                      ? "text-blue-300 bg-blue-900/40"
                      : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  {opt.desc && <span className="block text-gray-500 text-[10px]">{opt.desc}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 로딩 */}
      {loading && alerts.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-12 animate-pulse">로딩 중...</p>
      )}

      {/* 빈 상태 */}
      {!loading && groups.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">{pinnedOnly ? "★" : "🔍"}</p>
          <p className="text-gray-400 text-sm">
            {pinnedOnly
              ? "관심 등록한 종목이 없습니다."
              : stockFilter !== "all"
              ? `${selectedStockLabel} 조건에 맞는 알림이 없습니다.`
              : "아직 감지된 알림이 없습니다."}
          </p>
          {pinnedOnly && (
            <p className="text-gray-600 text-xs mt-2">
              카드 우측 ☆ 버튼으로 관심 종목을 등록하세요.
            </p>
          )}
          {!pinnedOnly && stockFilter === "all" && (
            <p className="text-gray-600 text-xs mt-2 leading-relaxed">
              15분마다 공시를 감시합니다.<br />
              전환사채 대규모 발행, 어닝 서프라이즈 등 이상 패턴이 감지되면 여기에 표시됩니다.
            </p>
          )}
        </div>
      )}

      {/* 회사별 그룹 카드 */}
      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <CompanyAlertCard
            key={group.corp_name}
            group={group}
            readIds={readIds}
            isPinned={pinned.has(group.corp_name)}
            onTogglePin={() => togglePin(group.corp_name)}
          />
        ))}
      </div>

      {groups.length > 0 && (
        <p className="text-xs text-gray-600 text-center mt-4">
          {groups.length}개사 · {filtered.length}건 표시
        </p>
      )}
    </>
  );
}
