"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type Disclosure } from "@/components/DisclosureCard";
import CompanyCard, { type CompanyGroup } from "@/components/CompanyCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SortKey = "latest" | "change_up" | "change_down" | "price_desc";
type StockFilter = "all" | "small_cap" | "penny";
type HaltFilter = "none" | "halt_scheduled" | "halted";
type Mode = "feed" | "earnings" | "favorites" | "search";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "change_up", label: "상승순" },
  { key: "change_down", label: "하락순" },
  { key: "price_desc", label: "가격순" },
];

const FILTER_OPTIONS: { key: StockFilter; label: string; desc: string }[] = [
  { key: "all", label: "전체", desc: "" },
  { key: "small_cap", label: "소형주", desc: "시총 3,000억↓" },
  { key: "penny", label: "동전주", desc: "1,000원↓" },
];

const HALT_FILTER_OPTIONS: { key: HaltFilter; label: string }[] = [
  { key: "none", label: "전체" },
  { key: "halt_scheduled", label: "거래정지 예정" },
  { key: "halted", label: "거래정지" },
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

  // 즐겨찾기 (localStorage 동기화)
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const stored = localStorage.getItem("smallcap_favorites");
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  function toggleFavorite(corpCode: string) {
    if (!corpCode) return;
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(corpCode)) next.delete(corpCode);
      else next.add(corpCode);
      try {
        localStorage.setItem("smallcap_favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  // 영업실적 탭
  const [earningsItems, setEarningsItems] = useState<Disclosure[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState("");
  const [earningsPage, setEarningsPage] = useState(1);

  const sortedGroups = useMemo(() => {
    let groups = attachPrices(groupByCompany(allItems));
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
  }, [allItems, sort, stockFilter, haltFilter]);

  const groups = sortedGroups.slice(0, page * PAGE_SIZE);
  const hasMore = groups.length < sortedGroups.length;

  const earningsGroups = useMemo(() => attachPrices(groupByCompany(earningsItems)), [earningsItems]);
  const pagedEarningsGroups = earningsGroups.slice(0, earningsPage * PAGE_SIZE);
  const hasMoreEarnings = pagedEarningsGroups.length < earningsGroups.length;

  // 즐겨찾기 그룹: allItems 기준 (필터 미적용)
  const favoriteGroups = useMemo(() => {
    return attachPrices(groupByCompany(allItems)).filter((g) => favorites.has(g.corp_code));
  }, [allItems, favorites]);

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
      const res = await fetch(`${API_URL}/disclosures/recent?days=30`);
      const data = await res.json();
      const fetched: Disclosure[] = (data.data ?? []).filter(
        (d: Disclosure) => d.report_nm?.includes("실적")
      );
      setEarningsItems(fetched);
      setEarningsPage(1);
      // 영업실적 종목 가격 별도 조회
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

  function handleTabChange(newMode: Mode) {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === "earnings" && earningsItems.length === 0 && !earningsLoading) {
      fetchEarnings();
    }
    if (newMode === "favorites" && allItems.length === 0 && !feedLoading) {
      fetchFeed(false, 7);
    }
  }

  function handleFilterChange(f: StockFilter) {
    const prev = stockFilter;
    setStockFilter(f);
    setFilterOpen(false);
    setPage(1);
    if (f === "small_cap" || prev === "small_cap") {
      fetchFeed(f === "small_cap", haltFilter !== "none" ? 14 : 3);
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

  const TAB_ITEMS: { key: Mode; label: string }[] = [
    { key: "feed", label: "피드" },
    { key: "earnings", label: "영업실적" },
    { key: "favorites", label: favorites.size > 0 ? `즐겨찾기 (${favorites.size})` : "즐겨찾기" },
  ];

  return (
    <main className="min-h-screen bg-gray-950 text-white">
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
            <h1 className="text-lg font-bold text-blue-400 mb-2">소형주 공시 레이더</h1>
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
            <div className="flex mt-3 -mb-3">
              {TAB_ITEMS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors border-b-2 ${
                    mode === key
                      ? "text-blue-400 border-blue-400"
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
                  onToggleFavorite={() => toggleFavorite(g.corp_code)}
                />
              ))}
            </div>

            {sortedGroups.length > 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">
                {groups.length} / {sortedGroups.length}개 회사
              </p>
            )}
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
              >
                더 보기 ({sortedGroups.length - groups.length}개 남음)
              </button>
            )}
          </>
        )}

        {/* ── 영업실적 탭 ── */}
        {mode === "earnings" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500">최근 30일 영업실적 공시 · AI 분석으로 ☀️/☁️ 확인</p>
              <button
                onClick={fetchEarnings}
                disabled={earningsLoading}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600"
              >
                {earningsLoading ? "..." : "새로고침"}
              </button>
            </div>

            {earningsError && <p className="text-red-400 text-sm mb-4">{earningsError}</p>}
            {earningsLoading && (
              <p className="text-xs text-gray-500 animate-pulse text-center py-8">영업실적 공시 불러오는 중...</p>
            )}
            {!earningsLoading && earningsGroups.length === 0 && !earningsError && (
              <p className="text-gray-500 text-sm text-center py-12">최근 30일 영업실적 공시가 없습니다.</p>
            )}

            <div className="flex flex-col gap-3">
              {pagedEarningsGroups.map((g) => (
                <CompanyCard
                  key={g.corp_code || g.corp_name}
                  group={g}
                  isFavorite={favorites.has(g.corp_code)}
                  onToggleFavorite={() => toggleFavorite(g.corp_code)}
                />
              ))}
            </div>

            {earningsGroups.length > 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">
                {pagedEarningsGroups.length} / {earningsGroups.length}개 회사
              </p>
            )}
            {hasMoreEarnings && (
              <button
                onClick={() => setEarningsPage((p) => p + 1)}
                className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
              >
                더 보기 ({earningsGroups.length - pagedEarningsGroups.length}개 남음)
              </button>
            )}
          </>
        )}

        {/* ── 즐겨찾기 탭 ── */}
        {mode === "favorites" && (
          <>
            {favorites.size === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm">즐겨찾기한 기업이 없습니다.</p>
                <p className="text-gray-600 text-xs mt-2">공시 카드의 ★를 눌러 추가하세요.</p>
              </div>
            ) : (
              <>
                {feedLoading && (
                  <p className="text-xs text-gray-500 animate-pulse text-center mb-4">피드 로드 중...</p>
                )}
                {!feedLoading && favoriteGroups.length === 0 && (
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
                      onToggleFavorite={() => toggleFavorite(g.corp_code)}
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
                  onToggleFavorite={() => toggleFavorite(g.corp_code)}
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
