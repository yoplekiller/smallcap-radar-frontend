"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Disclosure } from "./DisclosureCard";
import CompanyCard, { type CompanyGroup } from "./CompanyCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function formatKr(rcept_dt: string): string {
  if (rcept_dt.length !== 8) return rcept_dt;
  return `${rcept_dt.slice(4, 6)}/${rcept_dt.slice(6, 8)}`;
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>(toDateStr(today));

  const fetchDisclosures = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setDisclosures([]);
    try {
      const monthStr = `${y}${String(m + 1).padStart(2, "0")}`;
      const res = await fetch(`${API_URL}/disclosures/calendar?month=${monthStr}`);
      const data = await res.json();
      // data.data 는 { "20260510": [...], ... } 형태
      const grouped: Record<string, Disclosure[]> = data.data ?? {};
      const flat = Object.values(grouped).flat();
      setDisclosures(flat);
    } catch {
      setDisclosures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisclosures(year, month);
  }, [fetchDisclosures, year, month]);

  // 날짜별 그룹화
  const byDate = useMemo(() => {
    const map = new Map<string, Disclosure[]>();
    for (const d of disclosures) {
      const key = d.rcept_dt;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [disclosures]);

  // 이번 달 달력 날짜 배열
  const calDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=일
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function cellKey(day: number): string {
    return `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  }

  const isToday = (day: number) => {
    const d = new Date();
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  };

  const selectedDisclosures = byDate.get(selected) ?? [];
  const selectedLabel = selected.length === 8
    ? `${selected.slice(0, 4)}.${selected.slice(4, 6)}.${selected.slice(6, 8)}`
    : "";

  const selectedGroups = useMemo<CompanyGroup[]>(() => {
    const map = new Map<string, CompanyGroup>();
    for (const d of selectedDisclosures) {
      const key = d.corp_code ?? d.corp_name;
      if (!map.has(key)) {
        map.set(key, {
          corp_code: d.corp_code ?? "",
          corp_name: d.corp_name,
          stock_code: d.stock_code ?? "",
          disclosures: [],
        });
      }
      map.get(key)!.disclosures.push(d);
    }
    return Array.from(map.values());
  }, [selectedDisclosures]);

  const isFuture = (day: number) => {
    const now = new Date();
    const d = new Date(year, month, day);
    return d > now;
  };

  return (
    <div>
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="text-gray-400 hover:text-white px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors text-lg"
        >
          ‹
        </button>
        <span className="text-white font-semibold">
          {year}년 {month + 1}월
        </span>
        <button
          onClick={nextMonth}
          className="text-gray-400 hover:text-white px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors text-lg disabled:opacity-30"
          disabled={
            year === today.getFullYear() && month >= today.getMonth()
          }
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] font-medium py-1 ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      {loading ? (
        <p className="text-center text-gray-500 text-sm py-8 animate-pulse">불러오는 중...</p>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {calDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }
            const key = cellKey(day);
            const items = byDate.get(key) ?? [];
            const isSelected = selected === key;
            const future = isFuture(day);
            const dayOfWeek = idx % 7;

            return (
              <button
                key={key}
                disabled={future}
                onClick={() => setSelected(key)}
                className={`aspect-square flex flex-col items-center justify-start pt-1 rounded-lg transition-colors relative ${
                  isSelected
                    ? "bg-blue-600"
                    : future
                    ? "opacity-20 cursor-not-allowed"
                    : "hover:bg-gray-800"
                }`}
              >
                <span
                  className={`text-xs font-medium leading-none ${
                    isToday(day)
                      ? "text-yellow-400 font-bold"
                      : isSelected
                      ? "text-white"
                      : dayOfWeek === 0
                      ? "text-red-400"
                      : dayOfWeek === 6
                      ? "text-blue-400"
                      : "text-gray-300"
                  }`}
                >
                  {day}
                </span>
                {items.length > 0 && (
                  <span
                    className={`text-[9px] font-bold mt-0.5 px-1 rounded-full leading-none py-0.5 ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-blue-500/30 text-blue-300"
                    }`}
                  >
                    {items.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 선택한 날짜의 공시 목록 */}
      <div className="mt-4 border-t border-gray-800 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">
            {selectedLabel} 공시
          </h3>
          <span className="text-xs text-gray-500">
            {selectedGroups.length}개사 · {selectedDisclosures.length}건
          </span>
        </div>

        {selectedGroups.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">공시가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedGroups.map((g) => (
              <CompanyCard
                key={g.corp_code || g.corp_name}
                group={g}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
