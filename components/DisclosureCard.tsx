"use client";

export type Disclosure = {
  corp_name: string;
  stock_code: string;
  report_nm: string;
  rcept_no: string;
  rcept_dt: string;
  market_cap_억?: number;
  ai?: {
    score: number;
    sentiment: string;
    summary: string;
    reason: string;
    error?: string;
  };
  aiLoading?: boolean;
};

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
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-bold text-white">{item.corp_name}</span>
          <span className="ml-2 text-xs text-gray-500">{item.stock_code}</span>
          {item.market_cap_억 && (
            <span className="ml-2 text-xs text-blue-400">{item.market_cap_억}억</span>
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
      {item.ai && item.ai.summary && (
        <p className="text-xs text-gray-400 bg-gray-800 rounded p-2">{item.ai.summary}</p>
      )}
      {item.ai && item.ai.error && (
        <p className="text-xs text-red-400 bg-gray-800 rounded p-2">분석 실패: {item.ai.error}</p>
      )}
      <p className="text-xs text-gray-600 mt-2">{item.rcept_dt}</p>
    </div>
  );
}
