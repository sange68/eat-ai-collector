import { useEffect, useState } from "react";
import { api } from "../api";

type ReviewItem = {
  id: string;
  job_id: string;
  parsed_name: string | null;
  parsed_calories: number | null;
  parsed_protein: number | null;
  ai_confidence: string | null;
  ai_notes: string | null;
  review_status: string;
};

export default function Review() {
  const [items, setItems] = useState<ReviewItem[]>([]);

  const load = () => {
    api<ReviewItem[]>("/api/review/queue").then(setItems).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    await api(`/api/review/${id}/approve`, { method: "POST" });
    load();
  };

  const reject = async (id: string) => {
    await api(`/api/review/${id}/reject`, { method: "POST" });
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">審核佇列</h2>
      {items.length === 0 && <p className="text-slate-500">目前沒有待審項目</p>}
      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{item.parsed_name || "（無名稱）"}</h3>
              <p className="text-sm text-slate-600">
                熱量 {item.parsed_calories ?? "—"} kcal · 蛋白質{" "}
                {item.parsed_protein ?? "—"} g
              </p>
              <p className="text-xs text-slate-500 mt-1">
                AI: {item.ai_confidence} — {item.ai_notes}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => approve(item.id)}
                className="bg-emerald-600 text-white px-3 py-1 rounded text-sm"
              >
                通過
              </button>
              <button
                onClick={() => reject(item.id)}
                className="border px-3 py-1 rounded text-sm"
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
