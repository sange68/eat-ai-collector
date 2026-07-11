import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Stats = {
  total_items: number;
  by_confidence: Record<string, number>;
  by_brand: Record<string, number>;
  pending_reviews: number;
};

type Item = {
  id: string;
  name: string;
  brand: string | null;
  calories_kcal: number | null;
  protein_g: number | null;
  data_confidence: string | null;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Stats>("/api/stats"), api<Item[]>("/api/items?limit=20")])
      .then(([s, list]) => {
        setStats(s);
        setItems(list);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "載入失敗"));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p>載入中…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">儀表板</h2>
        <p className="text-sm text-slate-500 mt-1">
          三步流程：
          <Link className="text-emerald-700 underline mx-1" to="/workbench">
            工作台爬取
          </Link>
          →
          <Link className="text-emerald-700 underline mx-1" to="/review">
            審核通過
          </Link>
          → 這裡看到入庫品項
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="品項總數" value={String(stats.total_items)} />
        <Card title="待審核" value={String(stats.pending_reviews)} />
        <Card title="品牌數" value={String(Object.keys(stats.by_brand).length)} />
      </div>
      <section className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold mb-2">最近入庫品項</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            尚無資料。請先到工作台爬取，再到審核佇列按「通過入庫」。
          </p>
        ) : (
          <ul className="text-sm space-y-2">
            {items.map((item) => (
              <li key={item.id} className="border-b py-2 flex justify-between">
                <span>
                  {item.name}
                  {item.brand ? `（${item.brand}）` : ""}
                </span>
                <span className="text-slate-500">
                  {item.calories_kcal ?? "—"} kcal · P{item.protein_g ?? "—"} ·{" "}
                  {item.data_confidence}
                </span>
              </li>
            ))}
          </ul>
        )}
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
