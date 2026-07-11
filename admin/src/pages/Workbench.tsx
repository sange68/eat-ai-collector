import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Template = {
  id: string;
  name: string;
  domain: string;
  base_url: string;
};

type Job = {
  id: string;
  url: string | null;
  status: string;
  result_count: number;
  error_message?: string | null;
};

type Result = {
  id: string;
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
    image_url?: string;
    brand?: string;
    price_twd?: number;
  };
};

type JobDetail = {
  job: Job;
  results: Result[];
};

export default function Workbench() {
  const [url, setUrl] = useState("https://icook.tw/recipes/391516");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [tpls, jobList] = await Promise.all([
      api<Template[]>("/api/templates"),
      api<Job[]>("/api/scrape/jobs?limit=30"),
    ]);
    setTemplates(tpls);
    setJobs(jobList);
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "載入失敗"));
  }, []);

  const showDetail = async (jobId: string) => {
    const detail = await api<JobDetail>(`/api/scrape/jobs/${jobId}`);
    setActiveJob(detail);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const submitUrl = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const job = await api<Job>("/api/scrape/jobs", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      await load();
      await showDetail(job.id);
      if (job.status === "failed") {
        setError(job.error_message || "爬取失敗");
      } else {
        setMessage(`完成：抓到 ${job.result_count} 筆。請到審核佇列通過入庫。`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "失敗");
    } finally {
      setLoading(false);
    }
  };

  const runTemplate = async (templateId: string, name: string) => {
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const job = await api<Job>(`/api/scrape/templates/${templateId}/run`, {
        method: "POST",
      });
      await load();
      await showDetail(job.id);
      if (job.status === "failed") {
        setError(job.error_message || `${name} 更新失敗`);
      } else {
        setMessage(
          `「${name}」完成，抓到 ${job.result_count} 筆（含熱量/蛋白質/圖片）。下一步：審核入庫。`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "失敗");
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status: string) => {
    if (status === "completed") return "完成";
    if (status === "running") return "執行中";
    if (status === "failed") return "失敗";
    return "等待中";
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">① 網址 / 連鎖收集</h2>
        <p className="text-sm text-slate-600 mt-1">
          <b>一鍵更新</b>＝用系統內建模板，一次把該品牌營養目錄匯入「待審核」。
          不是更新網站程式，而是更新你的飲食資料庫。
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

      <section className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <h3 className="font-semibold">A. 連鎖 / 超商目錄（推薦先做）</h3>
        <p className="text-xs text-slate-500">
          Subway、麥當勞使用內建官方營養種子資料（含圖片與四大營養素）。點「一鍵更新」後到審核佇列通過即可入庫。
        </p>
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border rounded-lg px-3 py-3"
            >
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-slate-500">{t.base_url}</p>
              </div>
              <button
                disabled={loading}
                onClick={() => runTemplate(t.id, t.name)}
                className="text-sm bg-slate-900 text-white px-3 py-2 rounded hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? "處理中…" : "一鍵更新"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submitUrl} className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <h3 className="font-semibold">B. 貼單一網址（iCook 食譜）</h3>
        <p className="text-xs text-slate-500">
          會抓食譜名稱、圖片、食材，並用台灣食材庫估算每份熱量/蛋白質（標記為推算值）。
        </p>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <button
          disabled={loading}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "爬取中…" : "開始爬取"}
        </button>
      </form>

      <div ref={resultRef}>
        {activeJob && (
          <section className="bg-white p-4 rounded-xl shadow-sm space-y-3 border-2 border-emerald-200">
            <h3 className="font-semibold">本次結果（查看）</h3>
            <p className="text-sm text-slate-600">
              狀態：{statusLabel(activeJob.job.status)} · 結果數：
              {activeJob.results.length}
              {activeJob.job.error_message ? ` · 錯誤：${activeJob.job.error_message}` : ""}
            </p>
            {activeJob.results.length === 0 ? (
              <p className="text-sm text-amber-700">沒有抓到資料。</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {activeJob.results.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3 flex gap-3">
                    {r.raw_data?.image_url ? (
                      <img
                        src={r.raw_data.image_url}
                        alt=""
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{r.parsed_name}</p>
                      <p className="text-xs text-slate-600">
                        {r.parsed_calories ?? "—"} kcal · P{r.parsed_protein ?? "—"} · C
                        {r.parsed_carbs ?? "—"} · F{r.parsed_fat ?? "—"}
                      </p>
                      <p className="text-xs text-slate-400">{r.ai_notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeJob.results.length > 0 && (
              <Link
                to="/review"
                className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                下一步：去審核入庫
              </Link>
            )}
          </section>
        )}
      </div>

      <section className="bg-white p-4 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-2">最近任務</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">狀態</th>
              <th>來源</th>
              <th>結果數</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t">
                <td className="py-2">{statusLabel(j.status)}</td>
                <td className="truncate max-w-sm">{j.url}</td>
                <td>{j.result_count}</td>
                <td>
                  <button
                    className="text-emerald-700 underline"
                    onClick={() => showDetail(j.id).catch((e) => setError(String(e)))}
                  >
                    查看
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
