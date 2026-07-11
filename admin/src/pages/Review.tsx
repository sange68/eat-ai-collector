import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type ReviewItem = {
  id: string;
  job_id: string;
  parsed_name: string | null;
  parsed_calories: number | null;
  parsed_protein: number | null;
  parsed_carbs: number | null;
  parsed_fat: number | null;
  ai_confidence: string | null;
  ai_notes: string | null;
  review_status: string;
  raw_data?: {
    ingredients?: string[];
    brand?: string;
    source_url?: string;
    image_url?: string;
    price_twd?: number;
  };
};

export default function Review() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const data = await api<ReviewItem[]>("/api/review/queue");
    setItems(data);
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "載入失敗"));
  }, []);

  const approve = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      await api(`/api/review/${id}/approve`, { method: "POST" });
      setMessage("已通過並寫入品項庫（含營養與圖片，若有）");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setLoading(false);
    }
  };

  const approveAll = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ approved: number }>("/api/review/approve-all", {
        method: "POST",
      });
      setMessage(`已批次通過 ${res.approved} 筆`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setLoading(false);
    }
  };

  const reject = async (id: string) => {
    setLoading(true);
    try {
      await api(`/api/review/${id}/reject`, { method: "POST" });
      setMessage("已退回");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">③ 審核入庫</h2>
          <p className="text-sm text-slate-600 mt-1">
            這裡是最後關卡。通過後，總覽頁會顯示完整熱量、蛋白質與圖片。
          </p>
        </div>
        {items.length > 0 && (
          <button
            disabled={loading}
            onClick={approveAll}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            全部通過入庫（{items.length}）
          </button>
        )}
      </div>

      {message && (
        <p className="text-emerald-800 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {message}{" "}
          <Link className="underline" to="/">
            回總覽 →
          </Link>
        </p>
      )}
      {error && (
        <p className="text-red-700 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {items.length === 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm text-slate-500 text-sm space-y-2">
          <p>目前沒有待審項目。</p>
          <p>
            請先到{" "}
            <Link className="text-emerald-700 underline" to="/workbench">
              網址/連鎖收集
            </Link>{" "}
            或{" "}
            <Link className="text-emerald-700 underline" to="/google">
              Google 餐廳
            </Link>
            。
          </p>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex gap-4">
            {item.raw_data?.image_url ? (
              <img
                src={item.raw_data.image_url}
                alt=""
                className="w-24 h-24 object-cover rounded-lg"
              />
            ) : (
              <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">
                無圖
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{item.parsed_name || "（無名稱）"}</h3>
              <p className="text-sm text-slate-700 mt-1">
                <b>{item.parsed_calories ?? "—"}</b> kcal · 蛋白{" "}
                <b>{item.parsed_protein ?? "—"}</b> g · 碳水{" "}
                <b>{item.parsed_carbs ?? "—"}</b> g · 脂肪 <b>{item.parsed_fat ?? "—"}</b> g
                {item.raw_data?.price_twd != null ? ` · $${item.raw_data.price_twd}` : ""}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                AI: {item.ai_confidence} — {item.ai_notes}
              </p>
              {item.raw_data?.ingredients && (
                <p className="text-xs text-slate-400 mt-1">
                  食材：{item.raw_data.ingredients.join("、")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                disabled={loading}
                onClick={() => approve(item.id)}
                className="bg-emerald-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                通過入庫
              </button>
              <button
                disabled={loading}
                onClick={() => reject(item.id)}
                className="border px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                退回
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
