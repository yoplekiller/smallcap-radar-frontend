"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { type Disclosure } from "@/components/DisclosureCard";
import CompanyCard, { type CompanyGroup } from "@/components/CompanyCard";
import EarningsDashboard from "@/components/EarningsDashboard";
import AlertFeed from "@/components/AlertFeed";
import AlertsTab from "@/components/AlertsTab";
import PushToggle from "@/components/PushToggle";
import CalendarTab from "@/components/CalendarTab";
import ThemeToggle from "@/components/ThemeToggle";
import PortfolioTab from "@/components/PortfolioTab";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SortKey = "latest" | "change_up" | "change_down" | "price_desc";
type StockFilter = "all" | "small_cap" | "penny" | "etf";
type HaltFilter = "none" | "halt_scheduled" | "halted";
type DiscType = "all" | "cb" | "rights" | "treasury" | "major" | "governance";
type Mode = "feed" | "earnings" | "alerts" | "favorites" | "calendar" | "search" | "portfolio";
type FavEntry = { corp_code: string; corp_name: string; stock_code: string };

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "change_up", label: "상승순" },
  { key: "change_down", label: "하락순" },
  { key: "price_desc", label: "가격순" },
];

const FILTER_OPTIONS: { key: StockFilter; label: string; desc: string }[] = [
  { key: "all", label: "전체", desc: "" },
  { key: "small_cap", label: "소형주", desc: "시총 3,000억 이하" },
  { key: "penny", label: "동전주", desc: "1,000원 이하" },
  { key: "etf", label: "ETF", desc: "상장지수펀드" },
];

const ETF_KEYWORDS = ["ETF", "KODEX", "TIGER", "KINDEX", "HANARO", "ACE", "SOL", "TIMEFOLIO", "FOCUS", "ARIRANG", "상장지수"];

const HALT_FILTER_OPTIONS: { key: HaltFilter; label: string }[] = [
  { key: "none", label: "전체" },
  { key: "halt_scheduled", label: "거래정지 예정" },
  { key: "halted", label: "거래정지" },
];

const DISC_TYPE_OPTIONS: { key: DiscType; label: string; keywords: string[] }[] = [
  { key: "all",        label: "전체",     keywords: [] },
  { key: "cb",         label: "전환사채", keywords: ["전환사채"] },
  { key: "rights",     label: "유상증자", keywords: ["유상증자"] },
  { key: "treasury",   label: "자기주식", keywords: ["자기주식"] },
  { key: "major",      label: "주요사항", keywords: ["주요사항보고서"] },
  { key: "governance", label: "지분변동", keywords: ["주식등의대량보유", "임원ㆍ주요주주특정증권", "임원·주요주주"] },
];

const PAGE_SIZE = 10;

function groupByCompany(items: Disclosure[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();
  for (const item of items) {
    const key = item.corp_code ?? item.corp_name;
    if (!map.has(key)) {
      map.set(key, {
        corp_code: item.corp_code ?? "",
        corp_name: item.corp_name,
        stock_code: item.stock_code ?? "",
        disclosures: [],
      });
    }
    map.get(key)!.disclosures.push(item);
  }
  return Array.from(map.values());
}

function attachPrices(groups: CompanyGroup[]): CompanyGroup[] {
  return groups.map((g) => ({
    ...g,
    price: g.disclosures[0]?.price,
    change_rate: g.disclosures[0]?.change_rate,
    change_amount: g.disclosures[0]?.change_amount,
  }));
}

export default function Home() {
  const [sort, setSort] = useState<SortKey>("latest");
  const [sortOpen, setSortOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [haltFilter, setHaltFilter] = useState<HaltFilter>("none");
  const [haltOpen, setHaltOpen] = useState(false);
  const [discType, setDiscType] = useState<DiscType>("all");
  const [discTypeOpen, setDiscTypeOpen] = useState(false);
  const [allItems, setAllItems] = useState<Disclosure[]>([]);
  const [page, setPage] = useState(1);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");

  const [mode, setMode] = useState<Mode>("feed");
  const [query, setQuery] = useState("");
  const [searchDays, setSearchDays] = useState(30);
  const [searchGroups, setSearchGroups] = useState<CompanyGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // 공시 즐겨찾기 (localStorage 동기화)
  const [favorites, setFavorites] = useState<Map<string, FavEntry>>(new Map());
  useEffect(() => {
    try {
      const stored = localStorage.getItem("smallcap_favorites");
      if (stored) {
        const parsed = JSON.parse(stored) as unknown[];
        const map = new Map<string, FavEntry>();
        for (const item of parsed) {
          if (typeof item === "string") {
            map.set(item, { corp_code: item, corp_name: "", stock_code: "" });
          } else if (item && typeof item === "object" && "corp_code" in item) {
            const e = item as FavEntry;
            map.set(e.corp_code, e);
          }
        }
        setFavorites(map);
      }
    } catch {}
  }, []);

  function toggleFavorite(corpCode: string, corpName = "", stockCode = "") {
    if (!corpCode) return;
    setFavorites((prev) => {
      const next = new Map(prev);
      if (next.has(corpCode)) next.delete(corpCode);
      else next.set(corpCode, { corp_code: corpCode, corp_name: corpName, stock_code: stockCode });
      try {
        localStorage.setItem("smallcap_favorites", JSON.stringify([...next.values()]));
      } catch {}
      return next;
    });
  }

  const [favDisclosures, setFavDisclosures] = useState<Record<string, Disclosure[]>>({});
  const [favLoading, setFavLoading] = useState(false);

  // 실적 즐겨찾기 (별도 localStorage 키)
  const [earningsFavorites, setEarningsFavorites] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const stored = localStorage.getItem("smallcap_earnings_favorites");
      if (stored) setEarningsFavorites(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  function toggleEarningsFavorite(corpCode: string) {
    if (!corpCode) return;
    setEarningsFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(corpCode)) next.delete(corpCode);
      else next.add(corpCode);
      try {
        localStorage.setItem("smallcap_earnings_favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  // 즐겨찾기 탭 서브탭
  const [favSubTab, setFavSubTab] = useState<"disclosures" | "earnings">("disclosures");

  // 영업실적 탭
  const [earningsItems, setEarningsItems] = useState<Disclosure[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState("");
  const [earningsPage, setEarningsPage] = useState(1);

  const sortedGroups = useMemo(() => {
    const discTypeOpt = DISC_TYPE_OPTIONS.find((o) => o.key === discType)!;
    let items = allItems;
    if (discTypeOpt.keywords.length > 0) {
      items = items.filter((d) =>
        discTypeOpt.keywords.some((kw) => (d.report_nm ?? "").includes(kw))
      );
    }
    let groups = attachPrices(groupByCompany(items));
    if (stockFilter === "penny") {
      groups = groups.filter((g) => g.price != null && g.price < 1000);
    }
    if (stockFilter === "etf") {
      groups = groups.filter((g) =>
        ETF_KEYWORDS.some((kw) => g.corp_name.toUpperCase().includes(kw))
      );
    }
    if (haltFilter === "halt_scheduled") {
      groups = groups.filter((g) =>
        g.disclosures.some((d) => /거래정지예고|거래정지 예고|매매거래정지예고/.test(d.report_nm ?? ""))
      );
    } else if (haltFilter === "halted") {
      groups = groups.filter((g) => {
        const hasHalt = g.disclosures.some((d) => {
          const nm = d.report_nm ?? "";
          return nm.includes("거래정지") && !nm.includes("거래정지예고");
        });
        const hasResume = g.disclosures.some((d) => (d.report_nm ?? "").includes("거래재개"));
        return hasHalt && !hasResume;
      });
    }
    if (sort === "change_up") groups.sort((a, b) => (b.change_rate ?? -999) - (a.change_rate ?? -999));
    else if (sort === "change_down") groups.sort((a, b) => (a.change_rate ?? 999) - (b.change_rate ?? 999));
    else if (sort === "price_desc") groups.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return groups;
  }, [allItems, sort, stockFilter, haltFilter, discType]);

  const groups = sortedGroups.slice(0, page * PAGE_SIZE);
  const hasMore = groups.length < sortedGroups.length;

  const earningsGroups = useMemo(() => attachPrices(groupByCompany(earningsItems)), [earningsItems]);

  const sortedEarningsGroups = useMemo(() => {
    let groups = [...earningsGroups];
    if (stockFilter === "penny") {
      groups = groups.filter((g) => g.price != null && g.price < 1000);
    }
    if (haltFilter === "halt_scheduled") {
      groups = groups.filter((g) =>
        g.disclosures.some((d) => /거래정지예고|거래정지 예고|매매거래정지예고/.test(d.report_nm ?? ""))
      );
    } else if (haltFilter === "halted") {
      groups = groups.filter((g) => {
        const hasHalt = g.disclosures.some((d) => {
          const nm = d.report_nm ?? "";
          return nm.includes("거래정지") && !nm.includes("거래정지예고");
        });
        const hasResume = g.disclosures.some((d) => (d.report_nm ?? "").includes("거래재개"));
        return hasHalt && !hasResume;
      });
    }
    if (sort === "change_up") groups.sort((a, b) => (b.change_rate ?? -999) - (a.change_rate ?? -999));
    else if (sort === "change_down") groups.sort((a, b) => (a.change_rate ?? 999) - (b.change_rate ?? 999));
    else if (sort === "price_desc") groups.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return groups;
  }, [earningsGroups, sort, stockFilter, haltFilter]);

  const pagedEarningsGroups = sortedEarningsGroups.slice(0, earningsPage * PAGE_SIZE);
  const hasMoreEarnings = pagedEarningsGroups.length < sortedEarningsGroups.length;

  const feedSentinelRef = useInfiniteScroll(setPage, hasMore);
  const earningsSentinelRef = useInfiniteScroll(setEarningsPage, hasMoreEarnings);

  // 공시 즐겨찾기 그룹 — favDisclosures 우선, 없으면 피드 fallback
  const favoriteGroups = useMemo((): CompanyGroup[] => {
    if (Object.keys(favDisclosures).length > 0) {
      return [...favorites.values()].map((entry) => {
        const discs = favDisclosures[entry.corp_code] ?? [];
        return {
          corp_code: entry.corp_code,
          corp_name: entry.corp_name || discs[0]?.corp_name || entry.corp_code,
          stock_code: entry.stock_code || discs[0]?.stock_code || "",
          disclosures: discs,
          price: discs[0]?.price,
          change_rate: discs[0]?.change_rate,
          change_amount: discs[0]?.change_amount,
        };
      });
    }
    return attachPrices(groupByCompany(allItems)).filter((g) => favorites.has(g.corp_code));
  }, [favDisclosures, allItems, favorites]);

  // 실적 즐겨찾기 그룹
  const earningsFavoriteGroups = useMemo(() => {
    return attachPrices(groupByCompany(earningsItems)).filter((g) => earningsFavorites.has(g.corp_code));
  }, [earningsItems, earningsFavorites]);

  const fetchFavoritesData = useCallback(async (entries: FavEntry[]) => {
    if (!entries.length) return;
    setFavLoading(true);
    try {
      const results = await Promise.allSettled(
        entries.map(async (e) => {
          const res = await fetch(`${API_URL}/disclosures/company/${e.corp_code}/history?days=30`);
          const data = await res.json();
          return { code: e.corp_code, disclosures: (data.data ?? []) as Disclosure[] };
        })
      );
      const map: Record<string, Disclosure[]> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value.code] = r.value.disclosures;
      }
      setFavDisclosures(map);
    } catch {} finally {
      setFavLoading(false);
    }
  }, []);

  const fetchPrices = useCallback(async (disclosures: Disclosure[]) => {
    const tickers = [...new Set(disclosures.map((d) => d.stock_code).filter(Boolean))];
    if (!tickers.length) return;
    try {
      const res = await fetch(`${API_URL}/disclosures/prices?tickers=${tickers.join(",")}`);
      const priceMap: Record<string, { price: number; change_rate: number; change_amount: number }> = await res.json();
      setAllItems((prev) =>
        prev.map((d) => {
          const info = priceMap[d.stock_code];
          return info ? { ...d, ...info } : d;
        })
      );
    } catch {}
  }, []);

  const fetchFeed = useCallback(async (smallCapOnly: boolean, days = 3) => {
    setFeedLoading(true);
    setFeedError("");
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (smallCapOnly) params.set("small_cap_only", "true");
      const res = await fetch(`${API_URL}/disclosures/recent?${params}`);
      const data = await res.json();
      const fetched: Disclosure[] = data.data ?? [];
      setAllItems(fetched);
      setPage(1);
      fetchPrices(fetched);
    } catch {
      setFeedError("공시를 불러오지 못했습니다.");
    } finally {
      setFeedLoading(false);
    }
  }, [fetchPrices]);

  const fetchEarnings = useCallback(async () => {
    setEarningsLoading(true);
    setEarningsError("");
    try {
      const res = await fetch(`${API_URL}/disclosures/earnings?days=30`);
      const data = await res.json();
      const fetched: Disclosure[] = data.data ?? [];
      setEarningsItems(fetched);
      setEarningsPage(1);
      const tickers = [...new Set(fetched.map((d) => d.stock_code).filter(Boolean))];
      if (tickers.length) {
        try {
          const res2 = await fetch(`${API_URL}/disclosures/prices?tickers=${tickers.join(",")}`);
          const priceMap: Record<string, { price: number; change_rate: number; change_amount: number }> = await res2.json();
          setEarningsItems((prev) =>
            prev.map((d) => {
              const info = priceMap[d.stock_code];
              return info ? { ...d, ...info } : d;
            })
          );
        } catch {}
      }
    } catch {
      setEarningsError("영업실적 공시를 불러오지 못했습니다.");
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(false);
  }, [fetchFeed]);

  useEffect(() => {
    if (!allItems.length) return;
    const id = setInterval(() => fetchPrices(allItems), 60_000);
    return () => clearInterval(id);
  }, [allItems, fetchPrices]);

  function handleTabChange(newMode: Mode) {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === "earnings" && earningsItems.length === 0 && !earningsLoading) {
      fetchEarnings();
    }
    if (newMode === "favorites") {
      const favEntries = [...favorites.values()].filter((e) => e.corp_code);
      if (favEntries.length) fetchFavoritesData(favEntries);
      if (earningsItems.length === 0 && !earningsLoading && earningsFavorites.size > 0) {
        fetchEarnings();
      }
    }
  }

  function handleFilterChange(f: StockFilter) {
    const prev = stockFilter;
    setStockFilter(f);
    setFilterOpen(false);
    setPage(1);
    if (f === "small_cap" || prev === "small_cap") {
      fetchFeed(f === "small_cap", haltFilter !== "none" ? 14 : 3);
    } else if (f === "etf" && allItems.length === 0) {
      fetchFeed(false, 7);
    }
  }

  function handleHaltFilterChange(f: HaltFilter) {
    const prev = haltFilter;
    setHaltFilter(f);
    setHaltOpen(false);
    setPage(1);
    const prevDays = prev !== "none" ? 14 : 3;
    const nextDays = f !== "none" ? 14 : 3;
    if (prevDays !== nextDays) {
      fetchFeed(stockFilter === "small_cap", nextDays);
    }
  }

  function handleSortChange(s: SortKey) {
    setSort(s);
    setSortOpen(false);
    setPage(1);
  }

  function handleDiscTypeChange(t: DiscType) {
    setDiscType(t);
    setDiscTypeOpen(false);
    setPage(1);
  }

  const handlePullRefresh = useCallback(async () => {
    if (mode === "feed") {
      await fetchFeed(stockFilter === "small_cap", haltFilter !== "none" ? 14 : 3);
    } else if (mode === "earnings") {
      await fetchEarnings();
    } else if (mode === "favorites") {
      const favEntries = [...favorites.values()].filter((e) => e.corp_code);
      if (favEntries.length) await fetchFavoritesData(favEntries);
    }
  }, [mode, stockFilter, haltFilter, fetchFeed, fetchEarnings, favorites, fetchFavoritesData]);

  const { pullY, refreshing: pullRefreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(handlePullRefresh);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setMode("search");
    setSearchLoading(true);
    setSearchError("");
    try {
      const params = new URLSearchParams({ q: query.trim(), days: String(searchDays) });
      const res = await fetch(`${API_URL}/disclosures/search?${params}`);
      const data = await res.json();
      setSearchGroups(groupByCompany(data.data ?? []));
    } catch {
      setSearchError("검색 중 오류가 발생했습니다.");
    } finally {
      setSearchLoading(false);
    }
  }

  const activeFilter = FILTER_OPTIONS.find((o) => o.key === stockFilter)!;
  const activeHaltFilter = HALT_FILTER_OPTIONS.find((o) => o.key === haltFilter)!;

  const totalFavCount = favorites.size + earningsFavorites.size;
  const TAB_ITEMS: { key: Mode; label: string }[] = [
    { key: "feed", label: "공시" },
    { key: "earnings", label: "영업실적" },
    { key: "alerts", label: "세력 포착" },
    { key: "portfolio", label: "포트폴리오" },
    { key: "favorites", label: totalFavCount > 0 ? `즐겨찾기 (${totalFavCount})` : "즐겨찾기" },
    { key: "calendar", label: "캘린더" },
  ];

  return (
    <main
      className="min-h-screen bg-gray-950 text-white"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 당겨서 새로고침 인디케이터 */}
      {(pullY > 0 || pullRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-150 bg-gray-950"
          style={{ height: pullRefreshing ? 44 : pullY }}
        >
          <div className={`w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full ${pullRefreshing ? "animate-spin" : ""}`}
               style={{ transform: pullRefreshing ? undefined : `rotate(${(pullY / 70) * 270}deg)` }} />
        </div>
      )}
      <header className="border-b border-gray-800 px-4 py-3 sticky top-0 bg-gray-950 z-10">
        <div className="max-w-2xl mx-auto">
          {mode === "search" ? (
            <button
              onClick={() => { setMode("feed"); setQuery(""); }}
              className="flex items-center gap-2 text-blue-400 text-sm mb-2"
            >
              ← 공시 피드로
            </button>
          ) : (
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-lg font-bold text-blue-400">소형주 공시 레이더</h1>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <PushToggle />
                <AlertFeed />
              </div>
            </div>
          )}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="회사명 검색 (예: 카카오, 삼성)"
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!query.trim() || searchLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              {searchLoading ? "..." : "검색"}
            </button>
          </form>
          {/* 탭 바 */}
          {mode !== "search" && (
            <div className="flex mt-3 -mb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {TAB_ITEMS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                    mode === key
                      ? key === "alerts"
                        ? "text-red-400 border-red-400"
                        : "text-blue-400 border-blue-400"
                      : "text-gray-500 border-transparent hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* ── 피드 탭 ── */}
        {mode === "feed" && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative">
                <button
                  onClick={() => { setSortOpen((v) => !v); setFilterOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
                >
                  {SORT_OPTIONS.find((o) => o.key === sort)?.label}
                  <span className="text-gray-500 text-[10px]">{sortOpen ? "▲" : "▼"}</span>
                </button>
                {sortOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[90px] shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => handleSortChange(opt.key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          sort === opt.key ? "bg-blue-900 text-blue-300" : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setFilterOpen((v) => !v); setSortOpen(false); setHaltOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
                    stockFilter !== "all"
                      ? "bg-emerald-700 border-emerald-600 text-white"
                      : "border-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {activeFilter.label}
                  <span className="text-[10px] opacity-70">{filterOpen ? "▲" : "▼"}</span>
                </button>
                {filterOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[120px] shadow-lg">
                    {FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => handleFilterChange(opt.key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          stockFilter === opt.key ? "bg-emerald-900 text-emerald-300" : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.desc && <span className="ml-1.5 text-gray-500">{opt.desc}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setHaltOpen((v) => !v); setSortOpen(false); setFilterOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
                    haltFilter !== "none"
                      ? "bg-red-900 border-red-700 text-red-300"
                      : "border-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {activeHaltFilter.label}
                  <span className="text-[10px] opacity-70">{haltOpen ? "▲" : "▼"}</span>
                </button>
                {haltOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[120px] shadow-lg">
                    {HALT_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => handleHaltFilterChange(opt.key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          haltFilter === opt.key ? "bg-red-900 text-red-300" : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 공시 유형 필터 */}
              <div className="relative">
                <button
                  onClick={() => { setDiscTypeOpen((v) => !v); setSortOpen(false); setFilterOpen(false); setHaltOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
                    discType !== "all"
                      ? "bg-purple-800 border-purple-600 text-purple-200"
                      : "border-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {DISC_TYPE_OPTIONS.find((o) => o.key === discType)?.label}
                  <span className="text-[10px] opacity-70">{discTypeOpen ? "▲" : "▼"}</span>
                </button>
                {discTypeOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[110px] shadow-lg">
                    {DISC_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => handleDiscTypeChange(opt.key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          discType === opt.key ? "bg-purple-900 text-purple-300" : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {feedLoading && <span className="text-xs text-gray-500 animate-pulse ml-1">불러오는 중...</span>}
            </div>

            {feedError && <p className="text-red-400 text-sm mb-4">{feedError}</p>}
            {!feedLoading && sortedGroups.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-12">공시가 없습니다.</p>
            )}

            <div className="flex flex-col gap-3">
              {groups.map((g) => (
                <CompanyCard
                  key={g.corp_code || g.corp_name}
                  group={g}
                  isFavorite={favorites.has(g.corp_code)}
                  onToggleFavorite={() => toggleFavorite(g.corp_code, g.corp_name, g.stock_code)}
                />
              ))}
            </div>

            {sortedGroups.length > 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">
                {groups.length} / {sortedGroups.length}개 회사
              </p>
            )}
            <div ref={feedSentinelRef} className="h-1" />
            {hasMore && (
              <p className="text-xs text-gray-500 text-center py-3 animate-pulse">불러오는 중...</p>
            )}
          </>
        )}

        {/* ── 영업실적 탭 ── */}
        {mode === "earnings" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">최근 30일 영업실적 · AI 분석 후 증권사 예상치 비교 가능</p>
              <button
                onClick={fetchEarnings}
                disabled={earningsLoading}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600"
              >
                {earningsLoading ? "..." : "새로고침"}
              </button>
            </div>

            {/* 영업실적 필터 바 — 정렬 + 종목 필터만 */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative">
                <button
                  onClick={() => { setSortOpen((v) => !v); setFilterOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
                >
                  {SORT_OPTIONS.find((o) => o.key === sort)?.label}
                  <span className="text-gray-500 text-[10px]">{sortOpen ? "▲" : "▼"}</span>
                </button>
                {sortOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[90px] shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => handleSortChange(opt.key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          sort === opt.key ? "bg-blue-900 text-blue-300" : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setFilterOpen((v) => !v); setSortOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
                    stockFilter !== "all"
                      ? "bg-emerald-700 border-emerald-600 text-white"
                      : "border-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {activeFilter.label}
                  <span className="text-[10px] opacity-70">{filterOpen ? "▲" : "▼"}</span>
                </button>
                {filterOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[120px] shadow-lg">
                    {FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => handleFilterChange(opt.key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          stockFilter === opt.key ? "bg-emerald-900 text-emerald-300" : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.desc && <span className="ml-1.5 text-gray-500">{opt.desc}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {earningsLoading && <span className="text-xs text-gray-500 animate-pulse ml-1">불러오는 중...</span>}
            </div>

            <EarningsDashboard
              groups={pagedEarningsGroups}
              loading={earningsLoading}
              error={earningsError}
              favorites={earningsFavorites}
              onToggleFavorite={toggleEarningsFavorite}
            />

            {sortedEarningsGroups.length > 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">
                {pagedEarningsGroups.length} / {sortedEarningsGroups.length}개 회사
              </p>
            )}
            <div ref={earningsSentinelRef} className="h-1" />
            {hasMoreEarnings && (
              <p className="text-xs text-gray-500 text-center py-3 animate-pulse">불러오는 중...</p>
            )}
          </>
        )}

        {/* ── 세력 포착 탭 ── */}
        {mode === "alerts" && <AlertsTab />}

        {/* ── 포트폴리오 탭 ── */}
        {mode === "portfolio" && <PortfolioTab />}

        {/* ── 캘린더 탭 ── */}
        {mode === "calendar" && <CalendarTab />}

        {/* ── 즐겨찾기 탭 ── */}
        {mode === "favorites" && (
          <>
            {/* 서브탭 */}
            <div className="flex gap-1 mb-4 bg-gray-900 p-1 rounded-lg">
              <button
                onClick={() => setFavSubTab("disclosures")}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  favSubTab === "disclosures"
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                공시 즐겨찾기{favorites.size > 0 && ` (${favorites.size})`}
              </button>
              <button
                onClick={() => {
                  setFavSubTab("earnings");
                  if (earningsItems.length === 0 && !earningsLoading) fetchEarnings();
                }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  favSubTab === "earnings"
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                실적 즐겨찾기{earningsFavorites.size > 0 && ` (${earningsFavorites.size})`}
              </button>
            </div>

            {/* 공시 즐겨찾기 */}
            {favSubTab === "disclosures" && (
              <>
                {favorites.size === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-sm">즐겨찾기한 기업이 없습니다.</p>
                    <p className="text-gray-600 text-xs mt-2">피드 카드의 ★를 눌러 추가하세요.</p>
                  </div>
                ) : (
                  <>
                    {favLoading && (
                      <p className="text-xs text-gray-500 animate-pulse text-center mb-4">불러오는 중...</p>
                    )}
                    {!favLoading && favoriteGroups.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-12">
                        즐겨찾기 기업의 최근 공시가 없습니다.
                      </p>
                    )}
                    <div className="flex flex-col gap-3">
                      {favoriteGroups.map((g) => (
                        <CompanyCard
                          key={g.corp_code || g.corp_name}
                          group={g}
                          isFavorite={true}
                          onToggleFavorite={() => toggleFavorite(g.corp_code, g.corp_name, g.stock_code)}
                        />
                      ))}
                    </div>
                    {favoriteGroups.length > 0 && (
                      <p className="text-xs text-gray-600 text-center mt-4">
                        {favoriteGroups.length}개 기업 · 피드 기준 최근 공시
                      </p>
                    )}
                  </>
                )}
              </>
            )}

            {/* 실적 즐겨찾기 */}
            {favSubTab === "earnings" && (
              <>
                {earningsFavorites.size === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-sm">실적 즐겨찾기한 기업이 없습니다.</p>
                    <p className="text-gray-600 text-xs mt-2">영업실적 탭 카드의 ★를 눌러 추가하세요.</p>
                  </div>
                ) : (
                  <>
                    {earningsLoading && (
                      <p className="text-xs text-gray-500 animate-pulse text-center mb-4">실적 로드 중...</p>
                    )}
                    <EarningsDashboard
                      groups={earningsFavoriteGroups}
                      loading={false}
                      favorites={earningsFavorites}
                      onToggleFavorite={toggleEarningsFavorite}
                    />
                    {earningsFavoriteGroups.length > 0 && (
                      <p className="text-xs text-gray-600 text-center mt-4">
                        {earningsFavoriteGroups.length}개 기업
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── 검색 결과 ── */}
        {mode === "search" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-400">&ldquo;{query}&rdquo; 검색 결과</span>
              <select
                value={searchDays}
                onChange={(e) => setSearchDays(Number(e.target.value))}
                className="ml-auto bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1"
              >
                <option value={7}>7일</option>
                <option value={30}>30일</option>
                <option value={90}>90일</option>
              </select>
              <button
                onClick={() => handleSearch()}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                재검색
              </button>
            </div>

            {searchError && <p className="text-red-400 text-sm mb-4">{searchError}</p>}
            {!searchLoading && searchGroups.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-12">관련 공시가 없습니다.</p>
            )}

            <div className="flex flex-col gap-3">
              {searchGroups.map((g) => (
                <CompanyCard
                  key={g.corp_code || g.corp_name}
                  group={g}
                  isFavorite={favorites.has(g.corp_code)}
                  onToggleFavorite={() => toggleFavorite(g.corp_code, g.corp_name, g.stock_code)}
                />
              ))}
            </div>

            {searchGroups.length > 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">
                {searchGroups.length}개 회사 ·{" "}
                {searchGroups.reduce((s, g) => s + g.disclosures.length, 0)}건
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
