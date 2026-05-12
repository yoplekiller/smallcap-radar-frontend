"use client";

import { useState } from "react";
import { type Disclosure } from "./DisclosureCard";
import MarketCapBadge from "./MarketCapBadge";
import CompanyDetailModal from "./CompanyDetailModal";

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
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewerRcept, setViewerRcept] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
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
    <>
    {detailOpen && (
      <CompanyDetailModal group={group} onClose={() => setDetailOpen(false)} />
    )}

    {/* 공시 원문 인앱 뷰어 */}
    {viewerRcept && (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <button
            onClick={() => { setViewerRcept(null); setIframeLoaded(false); }}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
          >
            ← 닫기
          </button>
          <span className="text-xs text-gray-500">공시 원문</span>
          <a
            href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${viewerRcept}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            브라우저로 ↗
          </a>
        </div>
        {!iframeLoaded && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <iframe
          src={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${viewerRcept}`}
          className={`flex-1 w-full border-0 ${iframeLoaded ? "block" : "hidden"}`}
          onLoad={() => setIframeLoaded(true)}
          title="공시 원문"
        />
      </div>
    )}
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* 회사 헤더 */}
      <div
        onClick={toggle}
        className="w-full flex items-start justify-between px-4 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {/* 1행: 회사명 + 종목코드 */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-white truncate">{group.corp_name}</span>
            {group.stock_code && (
              <span className="text-xs text-gray-500 shrink-0">{group.stock_code}</span>
            )}
          </div>
          {/* 2행: 가격 / 퍼센트 / 공시 건수 */}
          <div className="flex items-center gap-2 flex-wrap">
            {group.price != null && (
              <span className="text-xs text-white font-medium">
                {group.price.toLocaleString()}원
              </span>
            )}
            {group.change_rate != null && (
              <span
                className={`text-xs font-medium ${
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
            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
              공시 {group.disclosures.length}건
            </span>
          </div>
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
          <button
            onClick={(e) => { e.stopPropagation(); setDetailOpen(true); }}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-900 hover:border-blue-700 px-2 py-0.5 rounded-lg transition-colors"
          >
            상세
          </button>
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
                const ai = aiResults[item.rcept_no] ?? item.ai;  // 백엔드 캐시 우선
                const isAnalyzing = analyzing[item.rcept_no];
                const dartUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`;
                return (
                  <li key={item.rcept_no} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href={dartUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-200 hover:text-blue-300 leading-snug block transition-colors"
                        >
                          {item.report_nm?.trim()}
                        </a>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDate(item.rcept_dt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setViewerRcept(item.rcept_no); setIframeLoaded(false); }}
                          className="text-[10px] text-gray-600 hover:text-blue-400 border border-gray-800 hover:border-blue-800 px-1.5 py-0.5 rounded transition-colors"
                        >
                          원문
                        </button>
                        {ai && ai.weather && (
                          <span className="text-base leading-none">
                            {ai.weather === "sunny" ? "☀️" : ai.weather === "cloudy" ? "☁️" : "🌤️"}
                          </span>
                        )}
                        {ai && ai.score >= 0 && (
                          <span
                            style={{
                              backgroundColor:
                                ai.sentiment === "positive"
                                  ? ai.score >= 8 ? "#059669" : ai.score >= 5 ? "#047857" : "#064e3b"
                                  : ai.sentiment === "negative"
                                  ? ai.score >= 8 ? "#dc2626" : ai.score >= 5 ? "#b91c1c" : "#7f1d1d"
                                  : ai.score >= 5 ? "#b45309" : "#4b5563",
                            }}
                            className="text-white text-xs font-bold px-1.5 py-0.5 rounded"
                            title="주가 영향도 (0~10)"
                          >
                            {ai.sentiment === "positive" ? "긍정" : ai.sentiment === "negative" ? "부정" : "중립"} · 주가 영향도 {ai.score}
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
                        {/* 시가총액 대비 공시 금액 배지 */}
                        {ai.market_cap_comment && ai.market_cap_ratio_pct != null && ai.market_cap_risk && (
                          <MarketCapBadge
                            ratioPct={ai.market_cap_ratio_pct}
                            scale={
                              ai.market_cap_risk === "critical" ? "초대형" :
                              ai.market_cap_risk === "high" ? "대형" :
                              ai.market_cap_risk === "medium" ? "중형" : "소형"
                            }
                            riskLevel={ai.market_cap_risk as "critical" | "high" | "medium" | "low"}
                            comment={ai.market_cap_comment}
                          />
                        )}
                        {/* 어닝쇼크 판정 배지 */}
                        {ai.shock_verdict && ai.shock_verdict_en && (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${
                                ai.shock_verdict_en === "shock"
                                  ? "bg-red-900 border-red-700 text-red-300"
                                  : ai.shock_verdict_en === "beat"
                                  ? "bg-green-900 border-green-700 text-green-300"
                                  : ai.shock_verdict_en === "beat_minor"
                                  ? "bg-emerald-900 border-emerald-700 text-emerald-300"
                                  : ai.shock_verdict_en === "miss"
                                  ? "bg-orange-900 border-orange-700 text-orange-300"
                                  : "bg-gray-800 border-gray-700 text-gray-400"
                              }`}
                            >
                              {ai.shock_verdict}
                              {ai.shock_diff_pct != null && (
                                <span className="opacity-70 font-normal">
                                  {ai.shock_diff_pct >= 0 ? "+" : ""}{ai.shock_diff_pct.toFixed(1)}%
                                </span>
                              )}
                            </span>
                            {ai.shock_comment && (
                              <p className="text-[11px] text-gray-400 leading-relaxed">{ai.shock_comment}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {ai && ai.error && (
                      <p className={`text-xs mt-1 ${ai.error.includes("한도 초과") ? "text-yellow-400" : "text-red-400"}`}>
                        {ai.error.includes("한도 초과") ? "⏳ " : ""}
                        {ai.error}
                      </p>
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
    </>
  );
}
