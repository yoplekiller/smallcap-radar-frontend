"use client";

import { useState } from "react";
import DisclosureCard, { type Disclosure } from "./DisclosureCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DisclosureFeed() {
  const [days, setDays] = useState(1);
  const [smallCapOnly, setSmallCapOnly] = useState(false);
  const [allItems, setAllItems] = useState<Disclosure[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PAGE_SIZE = 10;
  const items = allItems.slice(0, page * PAGE_SIZE);
  const hasMore = items.length < allItems.length;

  async function fetchDisclosures() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (smallCapOnly) params.set("small_cap_only", "true");
      const res = await fetch(`${API_URL}/disclosures/recent?${params}`);
      const data = await res.json();
      setAllItems(data.data ?? []);
      setPage(1);
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze(item: Disclosure) {
    setAllItems((prev) =>
      prev.map((d) => (d.rcept_no === item.rcept_no ? { ...d, aiLoading: true } : d))
    );
    try {
      const res = await fetch(`${API_URL}/disclosures/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      setAllItems((prev) =>
        prev.map((d) =>
          d.rcept_no === item.rcept_no ? { ...data, aiLoading: false } : d
        )
      );
    } catch {
      setAllItems((prev) =>
        prev.map((d) =>
          d.rcept_no === item.rcept_no
            ? { ...d, aiLoading: false, ai: { score: -1, sentiment: "neutral", summary: "", reason: "", error: "분석 요청 실패" } }
            : d
        )
      );
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
        >
          <option value={1}>오늘</option>
          <option value={3}>3일</option>
          <option value={7}>7일</option>
        </select>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setSmallCapOnly((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              smallCapOnly ? "bg-blue-600" : "bg-gray-700"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                smallCapOnly ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
          <span className="text-sm text-gray-300">소형주만 (시총 3000억↓)</span>
        </label>

        <button
          onClick={fetchDisclosures}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? "조회 중..." : "공시 조회"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {items.length === 0 && !loading && (
        <p className="text-gray-500 text-sm text-center py-12">
          조회 버튼을 눌러 공시를 불러오세요.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <DisclosureCard key={item.rcept_no} item={item} onAnalyze={handleAnalyze} />
        ))}
      </div>

      {allItems.length > 0 && (
        <p className="text-xs text-gray-600 text-center mt-4">
          {items.length} / {allItems.length}건
        </p>
      )}

      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
        >
          더 보기 ({allItems.length - items.length}건 남음)
        </button>
      )}
    </div>
  );
}
