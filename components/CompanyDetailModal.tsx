"use client";

import { useEffect, useState } from "react";
import { type CompanyGroup } from "./CompanyCard";
import { type Disclosure } from "./DisclosureCard";
import { type AlertItem, severityFromTitle } from "./AlertFeed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

type Tab = "history" | "news" | "alerts";

type NewsItem = { title: string; url: string; date: string; press: string };

function formatDate(d: string) {
  if (!d || d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

export default function CompanyDetailModal({
  group,
  onClose,
}: {
  group: CompanyGroup;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("history");
  const [history, setHistory] = useState<Disclosure[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!group.corp_code) return;
    setHistoryLoading(true);
    fetch(`${API_URL}/disclosures/company/${group.corp_code}/history?days=90`)
      .then((r) => r.json())
      .then((d) => setHistory(d.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [group.corp_code]);

  function handleTab(t: Tab) {
    setTab(t);
    if (t === "news" && news.length === 0 && !newsLoading && group.stock_code) {
      setNewsLoading(true);
      fetch(`${API_URL}/disclosures/news/${group.stock_code}?limit=10`)
        .then((r) => r.json())
        .then((d) => setNews(d.news ?? []))
        .catch(() => setNews([]))
        .finally(() => setNewsLoading(false));
    }
    if (t === "alerts" && alerts.length === 0 && !alertsLoading) {
      setAlertsLoading(true);
      fetch(`${API_URL}/alerts/history?limit=200`)
        .then((r) => r.json())
        .then((d) => {
          const all: AlertItem[] = d.data ?? [];
          setAlerts(all.filter((a) => a.corp_name === group.corp_name));
        })
        .catch(() => setAlerts([]))
        .finally(() => setAlertsLoading(false));
    }
  }

  const naverUrl = group.stock_code
    ? `https://finance.naver.com/item/main.nhn?code=${group.stock_code}`
    : null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "history", label: "공시 이력 (90일)" },
    { key: "news", label: "뉴스" },
    { key: "alerts", label: "세력 포착" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* 바텀 시트 */}
      <div className="relative bg-gray-950 rounded-t-2xl flex flex-col max-h-[92vh] w-full max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-800 shrink-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">{group.corp_name}</h2>
                {group.stock_code && (
                  <span className="text-xs text-gray-500 font-mono">{group.stock_code}</span>
                )}
              </div>
              {group.price != null && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-semibold text-white">
                    {group.price.toLocaleString()}원
                  </span>
                  {group.change_rate != null && (
                    <span
                      className={`text-sm font-medium ${
                        group.change_rate > 0
                          ? "text-red-400"
                          : group.change_rate < 0
                          ? "text-blue-400"
                          : "text-gray-500"
                      }`}
                    >
                      {group.change_rate > 0 ? "▲" : group.change_rate < 0 ? "▼" : ""}
                      {Math.abs(group.change_rate).toFixed(2)}%
                    </span>
                  )}
                  {group.change_amount != null && group.change_amount !== 0 && (
                    <span className="text-xs text-gray-500">
                      ({group.change_amount > 0 ? "+" : ""}
                      {group.change_amount.toLocaleString()}원)
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {naverUrl && (
                <a
                  href={naverUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-400 border border-green-800 hover:bg-green-900 px-2 py-1 rounded-lg transition-colors"
                >
                  네이버 차트
                </a>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-xl leading-none p-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-0 mt-1">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleTab(key)}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                  tab === key
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
        </div>

        {/* 컨텐츠 */}
        <div className="overflow-y-auto flex-1">
          {/* 공시 이력 */}
          {tab === "history" && (
            <>
              {historyLoading && (
                <p className="text-xs text-gray-500 animate-pulse text-center py-8">불러오는 중...</p>
              )}
              {!historyLoading && history.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-12">최근 90일 공시가 없습니다.</p>
              )}
              <ul className="divide-y divide-gray-800/60">
                {history.map((item) => (
                  <li key={item.rcept_no} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-200 hover:text-blue-300 leading-snug block transition-colors"
                        >
                          {item.report_nm?.trim()}
                        </a>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {formatDate(item.rcept_dt)}
                        </p>
                      </div>
                      {item.ai && item.ai.score >= 0 && (
                        <span
                          className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
                            item.ai.score >= 8
                              ? "bg-red-500 text-white"
                              : item.ai.score >= 5
                              ? "bg-yellow-500 text-white"
                              : "bg-gray-700 text-gray-300"
                          }`}
                        >
                          {item.ai.score}점
                        </span>
                      )}
                    </div>
                    {item.ai?.summary && (
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                        {item.ai.summary}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {!historyLoading && history.length > 0 && (
                <p className="text-xs text-gray-600 text-center py-3">
                  총 {history.length}건 · 최근 90일
                </p>
              )}
            </>
          )}

          {/* 뉴스 */}
          {tab === "news" && (
            <div className="px-4 py-3">
              {newsLoading && (
                <p className="text-xs text-gray-500 animate-pulse text-center py-8">뉴스 불러오는 중...</p>
              )}
              {!newsLoading && !group.stock_code && (
                <p className="text-gray-600 text-sm text-center py-12">비상장사는 뉴스를 지원하지 않습니다.</p>
              )}
              {!newsLoading && group.stock_code && news.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-12">관련 뉴스가 없습니다.</p>
              )}
              <ul className="flex flex-col gap-4">
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
                    <span className="text-xs text-gray-600 mt-0.5 block">
                      {n.press} · {n.date}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 세력 포착 이력 */}
          {tab === "alerts" && (
            <div className="px-4 py-3">
              {alertsLoading && (
                <p className="text-xs text-gray-500 animate-pulse text-center py-8">불러오는 중...</p>
              )}
              {!alertsLoading && alerts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600 text-sm">세력 포착 이력이 없습니다.</p>
                  <p className="text-gray-700 text-xs mt-1">이 종목에서 감지된 알림이 없어요.</p>
                </div>
              )}
              <ul className="flex flex-col gap-3">
                {alerts.map((a, i) => (
                  <li key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          severityFromTitle(a.title) === "danger"
                            ? "bg-red-900 text-red-300"
                            : severityFromTitle(a.title) === "opportunity"
                            ? "bg-green-900 text-green-300"
                            : "bg-yellow-900 text-yellow-300"
                        }`}
                      >
                        {a.title}
                      </span>
                      <span className="text-xs text-gray-600 shrink-0">
                        {a.triggered_at ? a.triggered_at.slice(0, 10) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-2 leading-relaxed">{a.comment}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
