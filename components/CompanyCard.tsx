"use client";

import { useState } from "react";
import { type Disclosure } from "./DisclosureCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "disclosures" | "news";

type NewsItem = {
  title: string;
  url: string;
  date: string;
  press: string;
};

export type CompanyGroup = {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  disclosures: Disclosure[];
  price?: number;
  change_rate?: number;
  change_amount?: number;
};

function formatDate(d: string) {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

export default function CompanyCard({
  group,
  isFavorite,
  onToggleFavorite,
}: {
  group: CompanyGroup;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("disclosures");
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [aiResults, setAiResults] = useState<Record<string, Disclosure["ai"]>>({});

  function toggle() {
    setOpen((v) => !v);
  }

  async function handleTabChange(t: Tab) {
    setTab(t);
    if (t === "news" && news === null && group.stock_code) {
      setNewsLoading(true);
      try {
        const res = await fetch(`${API_URL}/disclosures/news/${group.stock_code}?limit=5`);
        const data = await res.json();
        setNews(data.news ?? []);
      } catch {
        setNews([]);
      } finally {
        setNewsLoading(false);
      }
    }
  }

  function isEarningsReport(report_nm: string): boolean {
    return report_nm.includes("실적");
  }

  async function handleAnalyze(item: Disclosure) {
    const key = item.rcept_no;
    setAnalyzing((p) => ({ ...p, [key]: true }));
    const endpoint = isEarningsReport(item.report_nm)
      ? `${API_URL}/disclosures/analyze-earnings`
      : `${API_URL}/disclosures/analyze`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      setAiResults((p) => ({ ...p, [key]: data.ai }));
    } catch {
      setAiResults((p) => ({
        ...p,
        [key]: { score: -1, sentiment: "neutral", summary: "", reason: "", error: "분석 실패" },
      }));
    } finally {
      setAnalyzing((p) => ({ ...p, [key]: false }));
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* 회사 헤더 */}
      <div
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-white">{group.corp_name}</span>
          {group.stock_code && (
            <span className="text-xs text-gray-500">{group.stock_code}</span>
          )}
          {group.price != null && (
            <span className="text-xs">
              <span className="text-white font-medium">{group.price.toLocaleString()}원</span>
              {group.change_rate != null && (
                <span
                  className={`ml-1 font-medium ${
                    Math.abs(group.change_rate).toFixed(2) === "0.00"
                      ? "text-gray-500"
                      : group.change_rate > 0
                      ? "text-red-400"
                      : "text-blue-400"
                  }`}
                >
                  {Math.abs(group.change_rate).toFixed(2) !== "0.00" &&
                    (group.change_rate > 0 ? "▲" : "▼")}
                  {Math.abs(group.change_rate).toFixed(2)}%
                </span>
              )}
            </span>
          )}
          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
            공시 {group.disclosures.length}건
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className={`text-base leading-none transition-colors ${
                isFavorite ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400"
              }`}
              aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
            >
              {isFavorite ? "★" : "☆"}
            </button>
          )}
          <span className="text-gray-500 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-800">
          {/* 탭 */}
          <div className="flex border-b border-gray-800">
            {(["disclosures", "news"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t === "disclosures"
                  ? `기업 공시 (${group.disclosures.length})`
                  : "관련 뉴스"}
              </button>
            ))}
          </div>

          {/* 공시 목록 */}
          {tab === "disclosures" && (
            <ul className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {group.disclosures.map((item) => {
                const ai = aiResults[item.rcept_no];
                const isAnalyzing = analyzing[item.rcept_no];
                return (
                  <li key={item.rcept_no} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 leading-snug">
                          {item.report_nm?.trim()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDate(item.rcept_dt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ai && ai.weather && (
                          <span className="text-base leading-none">
                            {ai.weather === "sunny" ? "☀️" : ai.weather === "cloudy" ? "☁️" : "🌤️"}
                          </span>
                        )}
                        {ai && ai.score >= 0 && (
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              ai.score >= 8
                                ? "bg-red-500 text-white"
                                : ai.score >= 5
                                ? "bg-yellow-500 text-white"
                                : "bg-gray-600 text-white"
                            }`}
                          >
                            {ai.score}점
                          </span>
                        )}
                        {!ai && !isAnalyzing && (
                          <button
                            onClick={() => handleAnalyze(item)}
                            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-2 py-0.5 rounded transition-colors"
                          >
                            AI 분석
                          </button>
                        )}
                        {isAnalyzing && (
                          <span className="text-xs text-gray-500 animate-pulse">분석 중...</span>
                        )}
                      </div>
                    </div>
                    {ai && (ai.score >= 0 || ai.weather) && (
                      <div className="mt-2 bg-gray-800 rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ai.weather ? (
                            <>
                              <span className="text-base leading-none">
                                {ai.weather === "sunny" ? "☀️" : ai.weather === "cloudy" ? "☁️" : "🌤️"}
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  ai.weather === "sunny"
                                    ? "text-green-400"
                                    : ai.weather === "cloudy"
                                    ? "text-red-400"
                                    : "text-yellow-400"
                                }`}
                              >
                                {ai.weather === "sunny" ? "맑음" : ai.weather === "cloudy" ? "흐림" : "보합"}
                              </span>
                              {ai.change_pct != null && (
                                <span
                                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                    ai.change_pct >= 0 ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                                  }`}
                                >
                                  {ai.change_pct >= 0 ? "+" : ""}{ai.change_pct}%
                                </span>
                              )}
                            </>
                          ) : (
                            <span
                              className={`text-xs font-medium ${
                                ai.sentiment === "positive"
                                  ? "text-green-400"
                                  : ai.sentiment === "negative"
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {ai.sentiment === "positive" ? "긍정" : ai.sentiment === "negative" ? "부정" : "중립"}
                            </span>
                          )}
                          <span className="text-xs text-gray-600">·</span>
                          <span className="text-xs text-gray-400">{ai.reason}</span>
                        </div>
                        {ai.summary && (
                          <p className="text-xs text-gray-300 leading-relaxed">{ai.summary}</p>
                        )}
                      </div>
                    )}
                    {ai && ai.error && (
                      <p className="text-xs text-red-400 mt-1">{ai.error}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* 관련 뉴스 */}
          {tab === "news" && (
            <div className="px-4 py-3 max-h-80 overflow-y-auto">
              {newsLoading && (
                <p className="text-xs text-gray-500 animate-pulse">뉴스 불러오는 중...</p>
              )}
              {!newsLoading && !group.stock_code && (
                <p className="text-xs text-gray-600">비상장사는 뉴스를 지원하지 않습니다.</p>
              )}
              {!newsLoading && news?.length === 0 && (
                <p className="text-xs text-gray-600">관련 뉴스가 없습니다.</p>
              )}
              {!newsLoading && news && news.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {news.map((n, i) => (
                    <li key={i}>
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-200 hover:text-white leading-snug block"
                      >
                        {n.title}
                      </a>
                      <span className="text-xs text-gray-600">
                        {n.press} · {n.date}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
