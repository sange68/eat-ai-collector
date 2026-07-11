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
  carbs_g: number | null;
  fat_g: number | null;
  data_confidence: string | null;
  image_url: string | null;
  price_twd: number | null;
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">資料收集總覽</h2>
        <p className="text-sm text-slate-600 mt-1">
          這個網站用來把飲食資料收進資料庫。請依序使用下方三種收集方式，再去審核入庫。
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <MethodCard
          title="① 網址 / 連鎖收集"
          desc="貼 iCook 食譜網址，或一鍵匯入 Subway / 麥當勞官方營養目錄（含熱量、蛋白質、圖片）。"
          to="/workbench"
          cta="打開工作台"
        />
        <MethodCard
          title="② Google 餐廳探索"
          desc="選區域與類型（如大同區、燒烤店），勾選餐廳後匯入品項線索，再人工審核。"
          to="/google"
          cta="打開探索器"
        />
        <MethodCard
          title="③ 審核入庫"
          desc="所有收集結果都會先到這裡。按「通過入庫」後，儀表板才會出現完整營養資料。"
          to="/review"
          cta={`待審 ${stats.pending_reviews} 筆`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="已入庫品項" value={String(stats.total_items)} />
        <Card title="待審核" value={String(stats.pending_reviews)} />
        <Card title="品牌數" value={String(Object.keys(stats.by_brand).length)} />
      </div>

      <section className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold mb-3">最近入庫品項</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            尚無資料。建議先到工作台按「Subway 台灣營養目錄 → 一鍵更新」，再去審核全部通過。
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 flex gap-3">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="w-20 h-20 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">
                    無圖
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {item.name}
                    {item.brand ? `（${item.brand}）` : ""}
                  </p>
                  <p className="text-sm text-slate-600">
                    {item.calories_kcal ?? "—"} kcal · 蛋白 {item.protein_g ?? "—"}g · 碳水{" "}
                    {item.carbs_g ?? "—"}g · 脂肪 {item.fat_g ?? "—"}g
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.price_twd != null ? `$${item.price_twd} · ` : ""}
                    信心 {item.data_confidence}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MethodCard({
  title,
  desc,
  to,
  cta,
}: {
  title: string;
  desc: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-slate-600 mt-2 flex-1">{desc}</p>
      <Link
        to={to}
        className="mt-4 inline-block text-center bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm"
      >
        {cta}
      </Link>
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
