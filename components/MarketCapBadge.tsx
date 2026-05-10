"use client";

type RiskLevel = "critical" | "high" | "medium" | "low";

type Props = {
  ratioPct: number;
  scale: string;
  riskLevel: RiskLevel;
  comment: string;
};

const RISK_STYLES: Record<RiskLevel, { pill: string; bar: string }> = {
  critical: {
    pill: "bg-red-900 border-red-700 text-red-300",
    bar: "bg-red-500",
  },
  high: {
    pill: "bg-orange-900 border-orange-700 text-orange-300",
    bar: "bg-orange-500",
  },
  medium: {
    pill: "bg-yellow-900 border-yellow-700 text-yellow-300",
    bar: "bg-yellow-500",
  },
  low: {
    pill: "bg-gray-800 border-gray-700 text-gray-400",
    bar: "bg-gray-500",
  },
};

export default function MarketCapBadge({ ratioPct, scale, riskLevel, comment }: Props) {
  const styles = RISK_STYLES[riskLevel] ?? RISK_STYLES.low;
  const barWidth = Math.min(ratioPct, 100);

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs space-y-1.5 ${styles.pill}`}>
      {/* 헤더 행 */}
      <div className="flex items-center justify-between">
        <span className="font-semibold">시총 대비 공시 규모</span>
        <span className="font-bold text-sm">{ratioPct.toFixed(1)}%</span>
      </div>

      {/* 진행 바 */}
      <div className="w-full h-1.5 rounded-full bg-gray-700">
        <div
          className={`h-1.5 rounded-full transition-all ${styles.bar}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* 코멘트 */}
      <p className="opacity-80 leading-snug">{comment}</p>

      {/* 규모 배지 */}
      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${styles.bar} text-white`}>
        {scale} 이벤트
      </span>
    </div>
  );
}
