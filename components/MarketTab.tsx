"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

type IndexItem = { name: string; value: number | null; change: number | null; change_pct: number | null };
type MarketBreadth = { upper_limit: number | null; lower_limit: number | null; foreign_net_kospi: number | null };
type VolumeItem = { name: string; code: string; market: string; change_pct: number; volume_억: number };

type Overview = {
  indices: IndexItem[];
  vix: IndexItem;
  forex: IndexItem[];
  commodities: IndexItem[];
  futures: IndexItem[];
  market_breadth: MarketBreadth;
  top_volume: VolumeItem[];
};

function pct(v: number | null) {
  if (v == null) return "-";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function changeColor(v: number | null) {
  if (v == null) return "text-gray-400";
  return v > 0 ? "text-red-400" : v < 0 ? "text-blue-400" : "text-gray-400";
}

function fmt(v: number | null, decimals = 2) {
  if (v == null) return "-";
  return v.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function IndexCard({ item, size = "md" }: { item: IndexItem; size?: "sm" | "md" }) {
  const col = changeColor(item.change_pct);
  return (
    <div className={`bg-gray-900 rounded-xl p-3 flex flex-col gap-0.5 ${size === "sm" ? "min-w-[90px]" : ""}`}>
      <p className="text-[11px] text-gray-500 truncate">{item.name}</p>
      <p className={`font-bold ${size === "md" ? "text-base" : "text-sm"} text-white`}>
        {item.value != null ? item.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : "-"}
      </p>
      <p className={`text-xs ${col}`}>{pct(item.change_pct)}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-semibold mb-2 px-1">{title}</p>
      {children}
    </div>
  );
}

export default function MarketTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/market/overview`);
      if (!r.ok) throw new Error();
      setData(await r.json());
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setError("시장 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-3">{error}</p>
        <button onClick={load} className="text-blue-400 text-sm border border-blue-800 px-4 py-1.5 rounded-lg">
          재시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { indices, vix, forex, commodities, futures, market_breadth, top_volume } = data;

  return (
    <div className="space-y-5 pb-6">
      {/* 갱신 시각 */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-600">마지막 갱신: {lastUpdated}</p>
        <button onClick={load} className="text-[11px] text-blue-500 hover:text-blue-400">새로고침</button>
      </div>

      {/* 국내/해외 지수 */}
      <Section title="📈 주요 지수">
        <div className="grid grid-cols-2 gap-2">
          {indices.map((idx) => <IndexCard key={idx.name} item={idx} />)}
        </div>
      </Section>

      {/* 미국 선물 */}
      {futures?.length > 0 && (
        <Section title="🌙 미국 선물">
          <div className="grid grid-cols-2 gap-2">
            {futures.map((f) => <IndexCard key={f.name} item={f} />)}
          </div>
        </Section>
      )}

      {/* VIX */}
      <Section title="😨 공포지수 (VIX)">
        <div className="bg-gray-900 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-500">VIX — 시장 변동성 지수</p>
            <p className="text-lg font-bold text-white mt-0.5">
              {vix.value != null ? vix.value.toFixed(2) : "-"}
            </p>
            <p className={`text-xs mt-0.5 ${changeColor(vix.change_pct)}`}>{pct(vix.change_pct)}</p>
          </div>
          <div className={`text-3xl ${
            (vix.value ?? 0) >= 30 ? "opacity-100" : (vix.value ?? 0) >= 20 ? "opacity-80" : "opacity-40"
          }`}>
            {(vix.value ?? 0) >= 30 ? "🔴" : (vix.value ?? 0) >= 20 ? "🟡" : "🟢"}
          </div>
        </div>
      </Section>

      {/* 환율 */}
      <Section title="💱 환율">
        <div className="grid grid-cols-2 gap-2">
          {forex.map((f) => (
            <div key={f.name} className="bg-gray-900 rounded-xl p-3">
              <p className="text-[11px] text-gray-500">{f.name}</p>
              <p className="font-bold text-white text-base mt-0.5">
                {f.value != null ? f.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : "-"}
                <span className="text-[10px] text-gray-600 ml-1">원</span>
              </p>
              <p className={`text-xs mt-0.5 ${changeColor(f.change_pct)}`}>{pct(f.change_pct)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 원자재 */}
      <Section title="🛢️ 원자재">
        <div className="grid grid-cols-2 gap-2">
          {commodities.map((c) => (
            <div key={c.name} className="bg-gray-900 rounded-xl p-3">
              <p className="text-[11px] text-gray-500">{c.name} {c.name === "금" ? "(USD/oz)" : "(USD/bbl)"}</p>
              <p className="font-bold text-white text-base mt-0.5">
                ${c.value != null ? c.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-"}
              </p>
              <p className={`text-xs mt-0.5 ${changeColor(c.change_pct)}`}>{pct(c.change_pct)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 시장 분위기 */}
      {(market_breadth.upper_limit != null || market_breadth.lower_limit != null) && (
        <Section title="🌡️ 시장 분위기">
          <div className="bg-gray-900 rounded-xl p-3 flex gap-4">
            <div className="flex-1 text-center">
              <p className="text-[11px] text-gray-500">상한가</p>
              <p className="text-xl font-bold text-red-400 mt-1">
                {market_breadth.upper_limit ?? "-"}
              </p>
              <p className="text-[10px] text-gray-600">종목</p>
            </div>
            <div className="w-px bg-gray-800" />
            <div className="flex-1 text-center">
              <p className="text-[11px] text-gray-500">하한가</p>
              <p className="text-xl font-bold text-blue-400 mt-1">
                {market_breadth.lower_limit ?? "-"}
              </p>
              <p className="text-[10px] text-gray-600">종목</p>
            </div>
            {market_breadth.foreign_net_kospi != null && (
              <>
                <div className="w-px bg-gray-800" />
                <div className="flex-1 text-center">
                  <p className="text-[11px] text-gray-500">외국인 순매수</p>
                  <p className={`text-sm font-bold mt-1 ${market_breadth.foreign_net_kospi >= 0 ? "text-red-400" : "text-blue-400"}`}>
                    {market_breadth.foreign_net_kospi >= 0 ? "+" : ""}
                    {(market_breadth.foreign_net_kospi / 1e8).toFixed(0)}억
                  </p>
                  <p className="text-[10px] text-gray-600">코스피</p>
                </div>
              </>
            )}
          </div>
        </Section>
      )}

      {/* 거래대금 TOP5 */}
      {top_volume.length > 0 && (
        <Section title="💰 거래대금 TOP5">
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            {top_volume.map((item, i) => (
              <div key={item.code} className={`flex items-center justify-between px-3 py-2.5 ${i < top_volume.length - 1 ? "border-b border-gray-800" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-600 w-4">{i + 1}</span>
                  <div>
                    <p className="text-sm text-white font-medium">{item.name}</p>
                    <p className="text-[10px] text-gray-600">{item.market}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${changeColor(item.change_pct)}`}>
                    {item.change_pct >= 0 ? "+" : ""}{item.change_pct.toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-gray-500">{item.volume_억.toLocaleString()}억</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
