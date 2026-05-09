"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Disclosure = {
  corp_code?: string;
  corp_name: string;
  stock_code: string;
  report_nm: string;
  rcept_no: string;
  rcept_dt: string;
  market_cap_억?: number;
  price?: number;
  change_rate?: number;
  change_amount?: number;
  ai?: {
    score: number;
    sentiment: string;
    summary: string;
    reason: string;
    error?: string;
    weather?: "sunny" | "cloudy" | "neutral";
    change_pct?: number | null;
    curr_profit?: number | null;
    prev_profit?: number | null;
  };
  aiLoading?: boolean;
};

type NewsItem = {
  title: string;
  url: string;
  date: string;
  press: string;
};

function formatDate(d: string) {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-red-500" : score >= 5 ? "bg-yellow-500" : "bg-gray-600";
  return (
    <span className={`${color} text-white text-xs font-bold px-2 py-0.5 rounded`}>
      {score}점
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { label: string; color: string }> = {
    positive: { label: "긍정", color: "text-green-400" },
    negative: { label: "부정", color: "text-red-400" },
    neutral: { label: "중립", color: "text-gray-400" },
  };
  const s = map[sentiment] ?? map.neutral;
  return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
}

export default function DisclosureCard({
  item,
  onAnalyze,
}: {
  item: Disclosure;
  onAnalyze?: (item: Disclosure) => void;
}) {
  const price = item.price != null
    ? { price: item.price, change_rate: item.change_rate ?? 0, change_amount: item.change_amount ?? 0 }
    : null;
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
async function toggleNews() {
    if (newsOpen) {
      setNewsOpen(false);
      return;
    }
    setNewsOpen(true);
    if (news !== null) return;

    setNewsLoading(true);
    try {
      const res = await fetch(`${API_URL}/disclosures/news/${item.stock_code}?limit=5`);
      const data = await res.json();
      setNews(data.news ?? []);
    } catch {
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  }

return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-bold text-white">{item.corp_name}</span>
          <span className="ml-2 text-xs text-gray-500">{item.stock_code}</span>
          {item.market_cap_억 && (
            <span className="ml-2 text-xs text-blue-400">{item.market_cap_억}억</span>
          )}
          {price && (
            <span className="ml-2">
              <span className="text-sm font-medium text-white">{price.price.toLocaleString()}원</span>
              <span className={`ml-1 text-xs font-medium ${Math.abs(price.change_rate).toFixed(2) === "0.00" ? "text-gray-500" : price.change_rate > 0 ? "text-red-400" : "text-blue-400"}`}>
                {Math.abs(price.change_rate).toFixed(2) !== "0.00" && (price.change_rate > 0 ? "▲" : "▼")}{Math.abs(price.change_rate).toFixed(2)}%
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.ai && item.ai.score >= 0 && (
            <>
              <SentimentBadge sentiment={item.ai.sentiment} />
              <ScoreBadge score={item.ai.score} />
            </>
          )}
          {!item.ai && !item.aiLoading && onAnalyze && (
            <button
              onClick={() => onAnalyze(item)}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-2 py-0.5 rounded transition-colors"
            >
              AI 분석
            </button>
          )}
          {item.aiLoading && (
            <span className="text-xs text-gray-500 animate-pulse">분석 중...</span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-2">{item.report_nm}</p>

      {item.ai && item.ai.score >= 0 && (
        <div className="bg-gray-800 rounded-lg p-3 mb-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${
              item.ai.sentiment === "positive" ? "text-green-400" :
              item.ai.sentiment === "negative" ? "text-red-400" : "text-gray-400"
            }`}>
              {item.ai.sentiment === "positive" ? "긍정" : item.ai.sentiment === "negative" ? "부정" : "중립"}
            </span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-400">{item.ai.reason}</span>
          </div>
          {item.ai.summary && (
            <p className="text-xs text-gray-300 leading-relaxed">{item.ai.summary}</p>
          )}
        </div>
      )}
      {item.ai && item.ai.error && (
        <p className="text-xs text-red-400 mb-2">분석 실패: {item.ai.error}</p>
      )}

      {item.stock_code && (
        <div className="flex justify-end mt-2">
          <button
            onClick={toggleNews}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {newsOpen ? "뉴스 닫기 ▲" : "관련 뉴스 ▼"}
          </button>
        </div>
      )}

      {newsOpen && (
        <div className="mt-3 border-t border-gray-800 pt-3">
          {newsLoading && (
            <p className="text-xs text-gray-500 animate-pulse">뉴스 불러오는 중...</p>
          )}
          {!newsLoading && news && news.length === 0 && (
            <p className="text-xs text-gray-600">관련 뉴스가 없습니다.</p>
          )}
          {!newsLoading && news && news.length > 0 && (
            <>
              <ul className="flex flex-col gap-2">
                {news.map((n, i) => (
                  <li key={i}>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-300 hover:text-white leading-snug block"
                    >
                      {n.title}
                    </a>
                    <span className="text-xs text-gray-600">{n.press} · {n.date}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
