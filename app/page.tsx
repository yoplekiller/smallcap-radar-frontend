import DisclosureFeed from "@/components/DisclosureFeed";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold text-blue-400">소형주 공시 레이더</h1>
        <p className="text-sm text-gray-400">시총 3000억 미만 실시간 공시 분석</p>
      </header>
      <DisclosureFeed />
    </main>
  );
}
