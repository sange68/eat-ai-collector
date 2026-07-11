import { useEffect, useState } from "react";
import { api } from "../api";

type Stats = {
  total_items: number;
  by_confidence: Record<string, number>;
  by_brand: Record<string, number>;
  pending_reviews: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/api/stats").then(setStats).catch(console.error);
  }, []);

  if (!stats) return <p>載入中…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">儀表板</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="品項總數" value={String(stats.total_items)} />
        <Card title="待審核" value={String(stats.pending_reviews)} />
        <Card title="品牌數" value={String(Object.keys(stats.by_brand).length)} />
      </div>
      <section className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold mb-2">信心分布</h3>
        <ul className="text-sm space-y-1">
          {Object.entries(stats.by_confidence).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
