"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CompanyCard, { type CompanyGroup } from "./CompanyCard";
import { type Disclosure } from "./DisclosureCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
const LS_KEY = "smallcap_portfolio";

export type PortfolioItem = {
  corp_code: string;
  corp_name: string;
  stock_code: string;
};

function loadPortfolio(): PortfolioItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePortfolio(items: PortfolioItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {}
}

export default function PortfolioTab() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PortfolioItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [disclosures, setDisclosures] = useState<Record<string, Disclosure[]>>({});
  const [loadingCodes, setLoadingCodes] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    setPortfolio(loadPortfolio());
  }, []);

  async function handleSearch(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_URL}/disclosures/search?q=${encodeURIComponent(q.trim())}&days=7`);
      const data = await res.json();
      const seen = new Set<string>();
      const items: PortfolioItem[] = [];
      for (const d of (data.data ?? []) as Disclosure[]) {
        const key = d.corp_code ?? d.corp_name;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ corp_code: d.corp_code ?? "", corp_name: d.corp_name, stock_code: d.stock_code ?? "" });
        }
      }
      setSearchResults(items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function addToPortfolio(item: PortfolioItem) {
    setPortfolio((prev) => {
      if (prev.some((p) => p.corp_code === item.corp_code)) return prev;
      const next = [...prev, item];
      savePortfolio(next);
      return next;
    });
    setQuery("");
    setSearchResults([]);
    setShowSearch(false);
  }

  function removeFromPortfolio(corp_code: string) {
    setPortfolio((prev) => {
      const next = prev.filter((p) => p.corp_code !== corp_code);
      savePortfolio(next);
      return next;
    });
  }

  const fetchDisclosures = useCallback(async (item: PortfolioItem) => {
    if (!item.corp_code) return;
    setLoadingCodes((prev) => new Set(prev).add(item.corp_code));
    try {
      const res = await fetch(`${API_URL}/disclosures/company/${item.corp_code}/history?days=30`);
      const data = await res.json();
      setDisclosures((prev) => ({ ...prev, [item.corp_code]: data.data ?? [] }));
    } catch {
      setDisclosures((prev) => ({ ...prev, [item.corp_code]: [] }));
    } finally {
      setLoadingCodes((prev) => { const s = new Set(prev); s.delete(item.corp_code); return s; });
    }
  }, []);

  useEffect(() => {
    for (const item of portfolio) {
      if (!disclosures[item.corp_code] && !loadingCodes.has(item.corp_code)) {
        fetchDisclosures(item);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio]);

  const portfolioGroups = useMemo<(CompanyGroup & { item: PortfolioItem })[]>(() => {
    return portfolio.map((item) => ({
      corp_code: item.corp_code,
      corp_name: item.corp_name,
      stock_code: item.stock_code,
      disclosures: disclosures[item.corp_code] ?? [],
      item,
    }));
  }, [portfolio, disclosures]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">보유 종목 등록 → 관련 공시 우선 확인</p>
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-full transition-colors"
        >
          {showSearch ? "닫기" : "+ 종목 추가"}
        </button>
      </div>

      {/* 검색 */}
      {showSearch && (
        <div className="mb-4 bg-gray-900 rounded-xl p-3 border border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); handleSearch(e.target.value); }}
              placeholder="회사명 검색 (예: 삼성, 카카오)"
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            {searchLoading && <span className="text-xs text-gray-500 self-center">검색 중...</span>}
          </div>
          {searchResults.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-800 max-h-48 overflow-y-auto rounded-lg border border-gray-700">
              {searchResults.map((item) => (
                <li key={item.corp_code} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-200">{item.corp_name}</span>
                  <button
                    onClick={() => addToPortfolio(item)}
                    disabled={portfolio.some((p) => p.corp_code === item.corp_code)}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 shrink-0 ml-3"
                  >
                    {portfolio.some((p) => p.corp_code === item.corp_code) ? "추가됨" : "+ 추가"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && !searchLoading && searchResults.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-3">검색 결과 없음</p>
          )}
        </div>
      )}

      {/* 포트폴리오 목록 */}
      {portfolio.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">등록된 종목이 없습니다.</p>
          <p className="text-gray-600 text-xs mt-2">+ 종목 추가 버튼으로 보유 종목을 등록하세요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {portfolioGroups.map(({ item, ...group }) => (
            <div key={item.corp_code} className="relative">
              {/* 삭제 버튼 */}
              <button
                onClick={() => removeFromPortfolio(item.corp_code)}
                className="absolute top-2 right-2 z-10 text-[10px] text-gray-500 hover:text-red-400 transition-colors px-1"
                title="포트폴리오에서 제거"
              >
                ✕
              </button>
              {loadingCodes.has(item.corp_code) ? (
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <p className="text-sm text-gray-500 animate-pulse">{item.corp_name} 공시 불러오는 중...</p>
                </div>
              ) : (
                <CompanyCard group={group} />
              )}
              {!loadingCodes.has(item.corp_code) && group.disclosures.length === 0 && (
                <p className="text-xs text-gray-600 text-center -mt-2 mb-2">최근 30일 공시 없음</p>
              )}
            </div>
          ))}
        </div>
      )}

      {portfolio.length > 0 && (
        <p className="text-xs text-gray-600 text-center mt-4">{portfolio.length}개 종목 등록</p>
      )}
    </div>
  );
}
