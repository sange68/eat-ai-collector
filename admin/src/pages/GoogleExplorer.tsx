import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Place = {
  place_id: string;
  name: string;
  address?: string;
  rating?: number;
  user_rating_count?: number;
  primary_type?: string;
  review_summary?: string;
  menu_hints?: string[];
  demo?: boolean;
};

type SearchResponse = {
  mode: string;
  message: string;
  places: Place[];
  count: number;
  type_breakdown: Record<string, number>;
};

export default function GoogleExplorer() {
  const [area, setArea] = useState("台北市大同區");
  const [placeType, setPlaceType] = useState("燒烤店");
  const [minReviews, setMinReviews] = useState(50);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPlaces = useMemo(
    () => (result?.places || []).filter((p) => selected[p.place_id]),
    [result, selected]
  );

  const search = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await api<SearchResponse>("/api/places/search", {
        method: "POST",
        body: JSON.stringify({
          area,
          place_type: placeType,
          min_reviews: minReviews,
          min_rating: 0,
        }),
      });
      setResult(data);
      const init: Record<string, boolean> = {};
      data.places.forEach((p) => {
        init[p.place_id] = true;
      });
      setSelected(init);
      setMessage(`找到 ${data.count} 家。${data.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜尋失敗");
    } finally {
      setLoading(false);
    }
  };

  const importSelected = async () => {
    if (selectedPlaces.length === 0) {
      setError("請先勾選至少一家餐廳");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{ imported: number }>("/api/places/import", {
        method: "POST",
        body: JSON.stringify({ places: selectedPlaces }),
      });
      setMessage(`已匯入 ${res.imported} 筆品項線索到審核佇列。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯入失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">② Google 餐廳探索</h2>
        <p className="text-sm text-slate-600 mt-1">
          選區域與類型 → 預覽餐廳清單 → 勾選 → 匯入評論中的品項線索。
          營養數值需再經審核或對照食譜/連鎖資料補齊。
        </p>
      </div>

      {message && (
        <p className="text-emerald-800 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {message}{" "}
          <Link className="underline font-medium" to="/review">
            去審核 →
          </Link>
        </p>
      )}
      {error && (
        <p className="text-red-700 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <section className="bg-white p-4 rounded-xl shadow-sm grid md:grid-cols-4 gap-3">
        <label className="text-sm">
          區域
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </label>
        <label className="text-sm">
          類型
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={placeType}
            onChange={(e) => setPlaceType(e.target.value)}
          >
            <option>燒烤店</option>
            <option>火鍋</option>
            <option>牛肉麵</option>
            <option>小吃</option>
            <option>餐廳</option>
          </select>
        </label>
        <label className="text-sm">
          最低評論數
          <input
            type="number"
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={minReviews}
            onChange={(e) => setMinReviews(Number(e.target.value))}
          />
        </label>
        <div className="flex items-end">
          <button
            disabled={loading}
            onClick={search}
            className="w-full bg-emerald-600 text-white rounded-lg px-3 py-2 disabled:opacity-50"
          >
            {loading ? "搜尋中…" : "搜尋餐廳"}
          </button>
        </div>
      </section>

      {result && (
        <section className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              搜尋結果（{result.count}）· 模式：{result.mode === "demo" ? "示範資料" : "Google 正式"}
            </h3>
            <button
              disabled={loading}
              onClick={importSelected}
              className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              匯入已勾選（{selectedPlaces.length}）到審核
            </button>
          </div>
          <p className="text-xs text-slate-500">{result.message}</p>
          <div className="space-y-2">
            {result.places.map((p) => (
              <label
                key={p.place_id}
                className="flex gap-3 border rounded-lg p-3 cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={!!selected[p.place_id]}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [p.place_id]: e.target.checked }))
                  }
                />
                <div>
                  <p className="font-medium">
                    {p.name}{" "}
                    <span className="text-xs text-slate-500">
                      ★{p.rating} · {p.user_rating_count} 則評論
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">{p.address}</p>
                  <p className="text-sm text-slate-600 mt-1">{p.review_summary}</p>
                  {p.menu_hints && p.menu_hints.length > 0 && (
                    <p className="text-xs text-emerald-700 mt-1">
                      品項線索：{p.menu_hints.join("、")}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
