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
  };
};

export default function Review() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const data = await api<ReviewItem[]>("/api/review/queue");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      await api(`/api/review/${id}/approve`, { method: "POST" });
      setMessage("已通過並寫入品項庫");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setLoading(false);
    }
  };

  const reject = async (id: string) => {
    setLoading(true);
    setError("");
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
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">審核佇列</h2>
        <p className="text-sm text-slate-500 mt-1">
          爬下來的資料會先停在這裡。按「通過」才會進入正式品項庫，儀表板數字才會增加。
        </p>
      </div>

      {message && (
        <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {message}{" "}
          <Link className="underline" to="/">
            回儀表板查看 →
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
              URL 工作台
            </Link>{" "}
            貼網址開始爬取。
          </p>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-semibold">{item.parsed_name || "（無名稱）"}</h3>
              <p className="text-sm text-slate-600">
                熱量 {item.parsed_calories ?? "—"} kcal · 蛋白質{" "}
                {item.parsed_protein ?? "—"} g · 碳水 {item.parsed_carbs ?? "—"} g · 脂肪{" "}
                {item.parsed_fat ?? "—"} g
              </p>
              <p className="text-xs text-slate-500 mt-1">
                AI: {item.ai_confidence} — {item.ai_notes}
              </p>
              {item.raw_data?.ingredients && (
                <p className="text-xs text-slate-400 mt-1">
                  食材：{item.raw_data.ingredients.join("、")}
                </p>
              )}
              {item.raw_data?.source_url && (
                <a
                  className="text-xs text-emerald-700 underline"
                  href={item.raw_data.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看來源
                </a>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
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
