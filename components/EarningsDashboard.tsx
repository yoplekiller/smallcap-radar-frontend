"use client";

import { useState } from "react";
import { type CompanyGroup } from "./CompanyCard";
import { type Disclosure } from "./DisclosureCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ──────────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function fmt억(val: number | null | undefined): string {
  if (val == null) return "-";
  const 억 = Math.round(val / 1e8);
  return `${억.toLocaleString()}억`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return "-";
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
}

// ──────────────────────────────────────────────────────────────────
// 어닝쇼크 뱃지
// ──────────────────────────────────────────────────────────────────

const VERDICT_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  shock:       { bg: "bg-red-900 border-red-700",         text: "text-red-300",     icon: "📉" },
  miss:        { bg: "bg-orange-900 border-orange-700",   text: "text-orange-300",  icon: "▼" },
  inline:      { bg: "bg-gray-800 border-gray-700",       text: "text-gray-400",    icon: "↔" },
  beat_minor:  { bg: "bg-emerald-900 border-emerald-700", text: "text-emerald-300", icon: "▲" },
  beat:        { bg: "bg-green-900 border-green-700",     text: "text-green-300",   icon: "🚀" },
  unavailable: { bg: "bg-gray-800 border-gray-700",       text: "text-gray-500",    icon: "?" },
};

function ShockBadge({
  verdict,
  verdictEn,
  diffPct,
}: {
  verdict: string;
  verdictEn: string;
  diffPct: number | null;
}) {
  const style = VERDICT_STYLE[verdictEn] ?? VERDICT_STYLE.unavailable;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${style.bg} ${style.text}`}
    >
      <span>{style.icon}</span>
      <span>{verdict}</span>
      {diffPct != null && (
        <span className="opacity-70 font-normal">{fmtPct(diffPct)}</span>
      )}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// 개별 영업실적 카드 (접기/펼치기)
// ──────────────────────────────────────────────────────────────────

type ShockResult = {
  verdict: string;
  verdict_en: string;
  diff_pct: number | null;
  comment: string;
  consensus: { year: string; operating_profit_억: number } | null;
} | null;

function EarningsCard({
  group,
  isFavorite,
  onToggleFavorite,
}: {
  group: CompanyGroup;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [aiResults, setAiResults] = useState<Record<string, Disclosure["ai"]>>({});
  const [shockResults, setShockResults] = useState<Record<string, ShockResult>>({});
  const [shockLoading, setShockLoading] = useState<Record<string, boolean>>({});

  async function handleAnalyze(item: Disclosure) {
    const key = item.rcept_no;
    setAnalyzing((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetch(`${API_URL}/disclosures/analyze-earnings`, {
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

  async function handleShockCheck(item: Disclosure, currProfit: number | null) {
    if (!item.stock_code || currProfit == null) return;
    const key = item.rcept_no;
    setShockLoading((p) => ({ ...p, [key]: true }));
    try {
      const actual_억 = currProfit / 1e8;
      const res = await fetch(`${API_URL}/disclosures/earnings-shock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_code: item.stock_code, actual_억 }),
      });
      const data = await res.json();
      setShockResults((p) => ({ ...p, [key]: data }));
    } catch {
      setShockResults((p) => ({
        ...p,
        [key]: {
          verdict: "오류",
          verdict_en: "unavailable",
          diff_pct: null,
          comment: "증권사 예상치 조회 실패",
          consensus: null,
        },
      }));
    } finally {
      setShockLoading((p) => ({ ...p, [key]: false }));
    }
  }

  const earningsItems = group.disclosures.filter(
    (d) => d.report_nm?.includes("실적") || d.report_nm?.includes("영업")
  );
  if (earningsItems.length === 0) return null;

  // 헤더 날씨 미리보기 (분석된 첫 항목 기준)
  const firstAi =
    earningsItems.find((d) => d.ai || aiResults[d.rcept_no])?.ai ??
    earningsItems.map((d) => aiResults[d.rcept_no]).find(Boolean);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* ── 회사 헤더 (클릭 → 접기/펼치기) ── */}
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {/* 1행: 회사명 + 종목코드 */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-white truncate">{group.corp_name}</span>
            {group.stock_code && (
              <span className="text-xs text-gray-500 shrink-0">{group.stock_code}</span>
            )}
          </div>
          {/* 2행: 가격 / 등락율 / 날씨 / 실적 건수 */}
          <div className="flex items-center gap-2 flex-wrap">
            {group.price != null && (
              <span className="text-xs text-white font-medium">
                {group.price.toLocaleString()}원
              </span>
            )}
            {group.change_rate != null && Math.abs(group.change_rate) > 0 && (
              <span
                className={`text-xs font-medium ${
                  group.change_rate > 0 ? "text-red-400" : "text-blue-400"
                }`}
              >
                {group.change_rate > 0 ? "▲" : "▼"}
                {Math.abs(group.change_rate).toFixed(2)}%
              </span>
            )}
            {firstAi?.weather && (
              <span className="text-sm leading-none">
                {firstAi.weather === "sunny" ? "☀️" : firstAi.weather === "cloudy" ? "☁️" : "🌤️"}
              </span>
            )}
            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
              실적 {earningsItems.length}건
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`text-base leading-none transition-colors ${
                isFavorite
                  ? "text-yellow-400"
                  : "text-gray-600 hover:text-yellow-400"
              }`}
            >
              {isFavorite ? "★" : "☆"}
            </button>
          )}
          <span className="text-gray-500 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* ── 공시 목록 (펼쳐진 경우만) ── */}
      {open && (
        <ul className="divide-y divide-gray-800 border-t border-gray-800">
          {earningsItems.map((item) => {
            const ai = aiResults[item.rcept_no] ?? item.ai;
                const dartUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`;
            const isAnalyzing = analyzing[item.rcept_no];
            const shock = shockResults[item.rcept_no];
            const isShockLoading = shockLoading[item.rcept_no];

            const shockVerdict = shock?.verdict ?? ai?.shock_verdict;
            const shockVerdictEn = shock?.verdict_en ?? ai?.shock_verdict_en;
            const shockDiffPct = shock?.diff_pct ?? ai?.shock_diff_pct;
            const shockComment = shock?.comment ?? ai?.shock_comment;
            const consensusYear =
              (shock?.consensus as { year?: string } | null)?.year ??
              ai?.consensus_year;
            const consensus억 =
              (shock?.consensus as { operating_profit_억?: number } | null)
                ?.operating_profit_억 ?? ai?.consensus_억;

            return (
              <li key={item.rcept_no} className="px-4 py-4 space-y-3">
                {/* 공시 제목 + 날짜 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <a
                      href={dartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-200 hover:text-blue-300 leading-snug block transition-colors"
                    >
                      {item.report_nm}
                    </a>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {formatDate(item.rcept_dt)}
                    </p>
                  </div>
                  {!ai && !isAnalyzing && (
                    <button
                      onClick={() => handleAnalyze(item)}
                      className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-2 py-0.5 rounded shrink-0"
                    >
                      AI 분석
                    </button>
                  )}
                  {isAnalyzing && (
                    <span className="text-xs text-gray-500 animate-pulse shrink-0">
                      분석 중...
                    </span>
                  )}
                </div>

                {/* AI 분석 결과 */}
                {ai && (
                  <div className="space-y-2">
                    {/* 맑음/흐림 + 전년 대비 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {ai.weather && (
                        <span className="text-base leading-none">
                          {ai.weather === "sunny"
                            ? "☀️"
                            : ai.weather === "cloudy"
                            ? "☁️"
                            : "🌤️"}
                        </span>
                      )}
                      {ai.weather && (
                        <span
                          className={`text-xs font-medium ${
                            ai.weather === "sunny"
                              ? "text-green-400"
                              : ai.weather === "cloudy"
                              ? "text-red-400"
                              : "text-yellow-400"
                          }`}
                        >
                          {ai.weather === "sunny"
                            ? "맑음"
                            : ai.weather === "cloudy"
                            ? "흐림"
                            : "보합"}
                        </span>
                      )}
                      {ai.change_pct != null && (
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            ai.change_pct >= 0
                              ? "bg-red-500 text-white"
                              : "bg-blue-500 text-white"
                          }`}
                        >
                          전년비 {ai.change_pct >= 0 ? "+" : ""}
                          {ai.change_pct}%
                        </span>
                      )}
                    </div>

                    {/* 영업이익 3열 비교 */}
                    {(ai.curr_profit != null || ai.prev_profit != null) && (
                      <div className="grid grid-cols-3 gap-2 bg-gray-800 rounded-lg p-3">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">
                            전년동기
                          </p>
                          <p className="text-xs font-medium text-gray-300">
                            {fmt억(ai.prev_profit)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">
                            당기 실적
                          </p>
                          <p
                            className={`text-sm font-bold ${
                              ai.curr_profit != null && ai.prev_profit != null
                                ? ai.curr_profit >= ai.prev_profit
                                  ? "text-red-400"
                                  : "text-blue-400"
                                : "text-white"
                            }`}
                          >
                            {fmt억(ai.curr_profit)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">
                            증권사 예상치
                          </p>
                          <p className="text-xs font-medium text-purple-300">
                            {consensus억 != null
                              ? `${Number(consensus억).toLocaleString()}억`
                              : "-"}
                          </p>
                          {consensusYear && (
                            <p className="text-[10px] text-gray-600">
                              {consensusYear}E
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 어닝쇼크 판정 */}
                    {shockVerdict && shockVerdictEn && (
                      <div className="space-y-1">
                        <ShockBadge
                          verdict={shockVerdict}
                          verdictEn={shockVerdictEn}
                          diffPct={shockDiffPct ?? null}
                        />
                        {shockComment && (
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            {shockComment}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 증권사 예상치 비교 버튼 */}
                    {!shockVerdict &&
                      ai.curr_profit != null &&
                      item.stock_code && (
                        <button
                          onClick={() =>
                            handleShockCheck(item, ai.curr_profit ?? null)
                          }
                          disabled={isShockLoading}
                          className="text-[11px] text-purple-400 hover:text-purple-300 disabled:text-gray-600 border border-purple-900 hover:border-purple-700 px-2 py-0.5 rounded transition-colors"
                        >
                          {isShockLoading
                            ? "증권사 예상치 조회 중..."
                            : "증권사 예상치 비교"}
                        </button>
                      )}

                    {/* AI 요약 */}
                    {ai.summary && (
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {ai.summary}
                      </p>
                    )}
                    {ai.reason && (
                      <p className="text-xs text-gray-500 italic">{ai.reason}</p>
                    )}
                    {ai.error && (
                      <p className="text-xs text-red-400">{ai.error}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 대시보드 (최상위 export)
// ──────────────────────────────────────────────────────────────────

export default function EarningsDashboard({
  groups,
  loading,
  error,
  favorites,
  onToggleFavorite,
}: {
  groups: CompanyGroup[];
  loading?: boolean;
  error?: string;
  favorites?: Set<string>;
  onToggleFavorite?: (corpCode: string) => void;
}) {
  if (loading) {
    return (
      <p className="text-xs text-gray-500 animate-pulse text-center py-12">
        영업실적 공시 불러오는 중...
      </p>
    );
  }
  if (error) {
    return <p className="text-red-400 text-sm mb-4">{error}</p>;
  }
  if (groups.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm">최근 영업실적 공시가 없습니다.</p>
        <p className="text-gray-600 text-xs mt-2">
          AI 분석 버튼을 누르면 전년 대비 증감과 증권사 예상치를 비교합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 mb-1">
        <span>☀️ 맑음 (흑자·개선)</span>
        <span className="text-gray-700">|</span>
        <span>☁️ 흐림 (적자·하락)</span>
        <span className="text-gray-700">|</span>
        <span className="text-purple-400">증권사 예상치 비교 지원</span>
      </div>
      {groups.map((g) => (
        <EarningsCard
          key={g.corp_code || g.corp_name}
          group={g}
          isFavorite={favorites?.has(g.corp_code)}
          onToggleFavorite={
            onToggleFavorite ? () => onToggleFavorite(g.corp_code) : undefined
          }
        />
      ))}
    </div>
  );
}
