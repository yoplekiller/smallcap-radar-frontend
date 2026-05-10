"use client";

import { useEffect, useRef, useState } from "react";

export type NotifPrefs = {
  cb: boolean;         // 전환사채
  rights: boolean;     // 유상증자
  treasury: boolean;   // 자기주식
  major: boolean;      // 주요사항
  governance: boolean; // 지분변동
  portfolioOnly: boolean; // 내 포트폴리오만
  smallCapOnly: boolean;  // 소형주만
};

export const DEFAULT_PREFS: NotifPrefs = {
  cb: true,
  rights: true,
  treasury: true,
  major: true,
  governance: true,
  portfolioOnly: false,
  smallCapOnly: false,
};

const LS_KEY = "smallcap_notif_prefs";

export function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: NotifPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {}
}

type Row = {
  key: keyof NotifPrefs;
  label: string;
  desc: string;
  color: string;
};

const ROWS: Row[] = [
  { key: "cb",           label: "전환사채",   desc: "CB 발행 공시 알림",    color: "blue" },
  { key: "rights",       label: "유상증자",   desc: "신주 발행 공시 알림",  color: "emerald" },
  { key: "treasury",     label: "자기주식",   desc: "자사주 매입/소각 알림",color: "amber" },
  { key: "major",        label: "주요사항",   desc: "주요사항보고서 알림",  color: "purple" },
  { key: "governance",   label: "지분변동",   desc: "대량보유·임원 매매",   color: "pink" },
];

const SPECIAL_ROWS: Row[] = [
  { key: "portfolioOnly", label: "포트폴리오 종목만", desc: "내 포트폴리오 등록 종목 공시만",  color: "sky" },
  { key: "smallCapOnly",  label: "소형주만",           desc: "시총 3,000억 이하 종목만",        color: "orange" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${on ? "bg-blue-600" : "bg-gray-700"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export default function NotificationSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setPrefs(loadPrefs());
  }, [open]);

  function update(key: keyof NotifPrefs, val: boolean) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: val };
      savePrefs(next);
      return next;
    });
  }

  function handleReset() {
    savePrefs(DEFAULT_PREFS);
    setPrefs({ ...DEFAULT_PREFS });
  }

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg bg-gray-900 rounded-t-2xl pb-safe">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">알림 설정</h2>
          <div className="flex gap-3">
            <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-300">초기화</button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
          {/* 공시 유형별 */}
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">공시 유형</p>
          <div className="flex flex-col gap-3 mb-5">
            {ROWS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-200">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <Toggle on={prefs[key] as boolean} onChange={(v) => update(key, v)} />
              </div>
            ))}
          </div>

          {/* 특수 필터 */}
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">추가 필터</p>
          <div className="flex flex-col gap-3 mb-5">
            {SPECIAL_ROWS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-200">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <Toggle on={prefs[key] as boolean} onChange={(v) => update(key, v)} />
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600 text-center">
            설정은 즉시 저장됩니다. 세력 포착 탭 알림 피드에 적용됩니다.
          </p>
        </div>

        <div className="px-5 pb-6 pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
