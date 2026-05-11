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
  buy_price?: number;   // 매수가 (원)
  quantity?: number;    // 수량 (주)
  added_at: string;     // 등록일
};

type PriceInfo = {
  price: number;
  change_rate: number;
  change_amount: number;
  market_cap?: number;
};

function loadPortfolio(): PortfolioItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePortfolio(items: PortfolioItem[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

function fmt(n: number) { return n.toLocaleString("ko-KR"); }

function ReturnBadge({ rate, profit }: { rate: number; profit: number }) {
  const isPos = profit >= 0;
  const bg = isPos ? "#059669" : "#dc2626";
  const sign = isPos ? "+" : "";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span style={{ backgroundColor: bg }} className="text-white text-xs font-bold px-2 py-0.5 rounded">
        {sign}{rate.toFixed(2)}%
      </span>
      <span className={`text-xs font-medium ${isPos ? "text-emerald-400" : "text-red-400"}`}>
        {sign}{fmt(Math.round(profit))}원
      </span>
    </div>
  );
}

function PriceRow({ price }: { price: PriceInfo }) {
  const isUp = price.change_rate > 0;
  const isFlat = Math.abs(price.change_rate) < 0.01;
  const color = isFlat ? "text-gray-400" : isUp ? "text-red-400" : "text-blue-400";
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-white font-bold text-sm">{fmt(price.price)}원</span>
      {!isFlat && (
        <span className={`text-xs font-medium ${color}`}>
          {isUp ? "▲" : "▼"}{Math.abs(price.change_rate).toFixed(2)}%
        </span>
      )}
    </span>
  );
}

function EditForm({
  item,
  onSave,
  onCancel,
}: {
  item: PortfolioItem;
  onSave: (buy_price?: number, quantity?: number) => void;
  onCancel: () => void;
}) {
  const [bp, setBp] = useState(item.buy_price ? String(item.buy_price) : "");
  const [qty, setQty] = useState(item.quantity ? String(item.quantity) : "");
  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-xl border border-gray-700 mb-2">
      <p className="text-xs text-gray-400">매수 정보 수정 (선택사항)</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-gray-500 block mb-0.5">매수가 (원)</label>
          <input
            type="number"
            value={bp}
            onChange={(e) => setBp(e.target.value)}
            placeholder="예: 12500"
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-500 block mb-0.5">수량 (주)</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="예: 100"
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1">취소</button>
        <button
          onClick={() => onSave(bp ? Number(bp) : undefined, qty ? Number(qty) : undefined)}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg"
        >
          저장
        </button>
      </div>
    </div>
  );
}

function PortfolioCard({
  item,
  price,
  disclosures,
  loading,
  onRemove,
  onEdit,
}: {
  item: PortfolioItem;
  price?: PriceInfo;
  disclosures: Disclosure[];
  loading: boolean;
  onRemove: () => void;
  onEdit: (buy_price?: number, quantity?: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);

  const hasBuyInfo = item.buy_price != null && item.quantity != null;
  const currentPrice = price?.price;
  const returnRate = hasBuyInfo && currentPrice
    ? ((currentPrice - item.buy_price!) / item.buy_price!) * 100
    : null;
  const profit = hasBuyInfo && currentPrice
    ? (currentPrice - item.buy_price!) * item.quantity!
    : null;
  const currentValue = hasBuyInfo && currentPrice
    ? currentPrice * item.quantity!
    : null;

  const group: CompanyGroup = {
    corp_code: item.corp_code,
    corp_name: item.corp_name,
    stock_code: item.stock_code,
    disclosures,
    price: price?.price,
    change_rate: price?.change_rate,
    change_amount: price?.change_amount,
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="font-bold text-white text-base">{item.corp_name}</span>
            {item.stock_code && (
              <span className="ml-2 text-xs text-gray-500">{item.stock_code}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-900 hover:border-blue-700 px-2 py-0.5 rounded-lg transition-colors"
            >
              {editing ? "취소" : "수정"}
            </button>
            <button
              onClick={onRemove}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {editing && (
          <EditForm
            item={item}
            onSave={(bp, qty) => { onEdit(bp, qty); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        )}

        {/* 현재가 */}
        {price && <PriceRow price={price} />}

        {/* 수익률 */}
        {returnRate !== null && profit !== null && (
          <div className="mt-2">
            <ReturnBadge rate={returnRate} profit={profit} />
          </div>
        )}

        {/* 매수 정보 */}
        {hasBuyInfo && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center bg-gray-800 rounded-lg p-2">
            <div>
              <p className="text-[10px] text-gray-500">매수가</p>
              <p className="text-xs text-gray-200 font-medium">{fmt(item.buy_price!)}원</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">수량</p>
              <p className="text-xs text-gray-200 font-medium">{fmt(item.quantity!)}주</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">평가금액</p>
              <p className="text-xs text-gray-200 font-medium">
                {currentValue != null ? `${fmt(Math.round(currentValue / 10000))}만원` : "-"}
              </p>
            </div>
          </div>
        )}

        {!hasBuyInfo && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="mt-2 text-xs text-gray-600 hover:text-blue-400 transition-colors"
          >
            + 매수가·수량 입력하면 수익률 계산됩니다
          </button>
        )}
      </div>

      {/* 공시 이력 펼치기 */}
      <div className="border-t border-gray-800">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <span>
            {loading
              ? "공시 불러오는 중..."
              : `최근 30일 공시 ${disclosures.length}건`}
          </span>
          <span>{open ? "▲" : "▼"}</span>
        </button>
        {open && !loading && (
          <div className="border-t border-gray-800">
            {disclosures.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">공시 없음</p>
            ) : (
              <CompanyCard group={group} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortfolioTab() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PortfolioItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<PortfolioItem | null>(null);
  const [pendingBp, setPendingBp] = useState("");
  const [pendingQty, setPendingQty] = useState("");

  const [disclosures, setDisclosures] = useState<Record<string, Disclosure[]>>({});
  const [loadingCodes, setLoadingCodes] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});

  useEffect(() => { setPortfolio(loadPortfolio()); }, []);

  async function handleSearch(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_URL}/disclosures/companies/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      const items: PortfolioItem[] = (data.data ?? []).map(
        (c: { corp_code: string; corp_name: string; stock_code: string }) => ({
          corp_code: c.corp_code,
          corp_name: c.corp_name,
          stock_code: c.stock_code ?? "",
          added_at: new Date().toISOString(),
        })
      );
      setSearchResults(items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function selectPending(item: PortfolioItem) {
    setPendingAdd(item);
    setPendingBp("");
    setPendingQty("");
  }

  function confirmAdd() {
    if (!pendingAdd) return;
    const newItem: PortfolioItem = {
      ...pendingAdd,
      buy_price: pendingBp ? Number(pendingBp) : undefined,
      quantity: pendingQty ? Number(pendingQty) : undefined,
    };
    setPortfolio((prev) => {
      if (prev.some((p) => p.corp_code === newItem.corp_code)) return prev;
      const next = [...prev, newItem];
      savePortfolio(next);
      return next;
    });
    setPendingAdd(null);
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
    setDisclosures((prev) => { const s = { ...prev }; delete s[corp_code]; return s; });
    setPrices((prev) => { const s = { ...prev }; delete s[corp_code]; return s; });
  }

  function editBuyInfo(corp_code: string, buy_price?: number, quantity?: number) {
    setPortfolio((prev) => {
      const next = prev.map((p) =>
        p.corp_code === corp_code ? { ...p, buy_price, quantity } : p
      );
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

  const fetchPrices = useCallback(async (items: PortfolioItem[]) => {
    const tickers = items.map((i) => i.stock_code).filter(Boolean);
    if (!tickers.length) return;
    try {
      const res = await fetch(`${API_URL}/disclosures/prices?tickers=${tickers.join(",")}`);
      const data: Record<string, PriceInfo> = await res.json();
      setPrices((prev) => ({ ...prev, ...data }));
    } catch {}
  }, []);

  useEffect(() => {
    for (const item of portfolio) {
      if (!disclosures[item.corp_code] && !loadingCodes.has(item.corp_code)) {
        fetchDisclosures(item);
      }
    }
    if (portfolio.length) fetchPrices(portfolio);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio]);

  // 총 평가금액·수익금 합산
  const summary = useMemo(() => {
    let totalBuy = 0, totalCurrent = 0, count = 0;
    for (const item of portfolio) {
      const p = prices[item.stock_code];
      if (item.buy_price && item.quantity && p) {
        totalBuy += item.buy_price * item.quantity;
        totalCurrent += p.price * item.quantity;
        count++;
      }
    }
    if (!count) return null;
    return { totalBuy, totalCurrent, profit: totalCurrent - totalBuy, rate: ((totalCurrent - totalBuy) / totalBuy) * 100 };
  }, [portfolio, prices]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">보유 종목 수익률 · 공시 모니터링</p>
        <button
          onClick={() => { setShowSearch((v) => !v); setPendingAdd(null); }}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-full transition-colors"
        >
          {showSearch ? "닫기" : "+ 종목 추가"}
        </button>
      </div>

      {/* 총 수익 요약 */}
      {summary && (
        <div className="mb-4 bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-2">포트폴리오 요약</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-500">매수금액</p>
              <p className="text-xs text-gray-200 font-medium">{Math.round(summary.totalBuy / 10000).toLocaleString()}만원</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">평가금액</p>
              <p className="text-xs text-gray-200 font-medium">{Math.round(summary.totalCurrent / 10000).toLocaleString()}만원</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">총 수익률</p>
              <p className={`text-xs font-bold ${summary.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {summary.profit >= 0 ? "+" : ""}{summary.rate.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 검색 */}
      {showSearch && (
        <div className="mb-4 bg-gray-900 rounded-xl p-3 border border-gray-700">
          {!pendingAdd ? (
            <>
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
                        onClick={() => selectPending(item)}
                        disabled={portfolio.some((p) => p.corp_code === item.corp_code)}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 shrink-0 ml-3"
                      >
                        {portfolio.some((p) => p.corp_code === item.corp_code) ? "추가됨" : "선택"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && !searchLoading && searchResults.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-3">검색 결과 없음</p>
              )}
            </>
          ) : (
            /* 매수가·수량 입력 단계 */
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setPendingAdd(null)} className="text-gray-500 hover:text-gray-300 text-sm">←</button>
                <span className="text-sm font-bold text-white">{pendingAdd.corp_name}</span>
                <span className="text-xs text-gray-500">{pendingAdd.stock_code}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">매수 정보 입력 (선택사항 — 비워두면 모니터링만)</p>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-500 block mb-1">매수가 (원)</label>
                  <input
                    type="number"
                    value={pendingBp}
                    onChange={(e) => setPendingBp(e.target.value)}
                    placeholder="예: 12500"
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-500 block mb-1">수량 (주)</label>
                  <input
                    type="number"
                    value={pendingQty}
                    onChange={(e) => setPendingQty(e.target.value)}
                    placeholder="예: 100"
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              {pendingBp && pendingQty && (
                <p className="text-xs text-gray-500 mb-2">
                  매수금액: {(Number(pendingBp) * Number(pendingQty)).toLocaleString()}원
                </p>
              )}
              <button
                onClick={confirmAdd}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                등록
              </button>
            </div>
          )}
        </div>
      )}

      {/* 포트폴리오 목록 */}
      {portfolio.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">등록된 종목이 없습니다.</p>
          <p className="text-gray-600 text-xs mt-2">+ 종목 추가로 보유 종목과 수익률을 관리하세요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {portfolio.map((item) => (
            <PortfolioCard
              key={item.corp_code}
              item={item}
              price={prices[item.stock_code]}
              disclosures={disclosures[item.corp_code] ?? []}
              loading={loadingCodes.has(item.corp_code)}
              onRemove={() => removeFromPortfolio(item.corp_code)}
              onEdit={(bp, qty) => editBuyInfo(item.corp_code, bp, qty)}
            />
          ))}
        </div>
      )}

      {portfolio.length > 0 && (
        <p className="text-xs text-gray-600 text-center mt-4">{portfolio.length}개 종목</p>
      )}
    </div>
  );
}
