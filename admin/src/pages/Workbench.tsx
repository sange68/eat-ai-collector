import { FormEvent, useEffect, useState } from "react";
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
  created_at?: string | null;
};

type JobDetail = {
  job: Job;
  results: Array<{
    id: string;
    parsed_name: string | null;
    parsed_calories: number | null;
    parsed_protein: number | null;
    ai_confidence: string | null;
    ai_notes: string | null;
    review_status: string;
    raw_data?: {
      ingredients?: string[];
      title?: string;
      source_url?: string;
    };
  }>;
};

export default function Workbench() {
  const [url, setUrl] = useState("https://icook.tw/recipes/391516");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null);

  const load = async () => {
    try {
      const [tpls, jobList] = await Promise.all([
        api<Template[]>("/api/templates"),
        api<Job[]>("/api/scrape/jobs"),
      ]);
      setTemplates(tpls);
      setJobs(jobList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const waitForJob = async (jobId: string) => {
    for (let i = 0; i < 20; i++) {
      const detail = await api<JobDetail>(`/api/scrape/jobs/${jobId}`);
      setActiveJob(detail);
      if (detail.job.status === "completed" || detail.job.status === "failed") {
        return detail;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return api<JobDetail>(`/api/scrape/jobs/${jobId}`);
  };

  const submitUrl = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    setActiveJob(null);
    try {
      const job = await api<Job>("/api/scrape/jobs", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setMessage(`任務已建立，正在爬取…（${job.id.slice(0, 8)}）`);
      const detail = await waitForJob(job.id);
      if (detail.job.status === "failed") {
        setError(detail.job.error_message || "爬取失敗");
        setMessage("");
      } else {
        setMessage(
          `爬取完成：共 ${detail.results.length} 筆，請到「審核佇列」通過後才會入庫`
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "失敗");
    } finally {
      setLoading(false);
    }
  };

  const runTemplate = async (templateId: string) => {
    setMessage("");
    setError("");
    setLoading(true);
    setActiveJob(null);
    try {
      const job = await api<Job>(`/api/scrape/templates/${templateId}/run`, {
        method: "POST",
      });
      setMessage(`模板更新中…（${job.id.slice(0, 8)}）`);
      const detail = await waitForJob(job.id);
      if (detail.job.status === "failed") {
        setError(detail.job.error_message || "模板更新失敗");
        setMessage("");
      } else {
        setMessage(`完成：抓到 ${detail.results.length} 筆，請前往審核`);
      }
      await load();
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">URL 工作台</h2>
        <p className="text-sm text-slate-500 mt-1">
          使用方式：貼上食譜/營養頁網址 → 開始爬取 → 到「審核佇列」按通過 → 資料才會進入品項庫
        </p>
      </div>

      {message && (
        <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {message}{" "}
          {message.includes("審核") && (
            <Link className="underline font-medium" to="/review">
              前往審核佇列 →
            </Link>
          )}
        </p>
      )}
      {error && (
        <p className="text-red-700 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <form
        onSubmit={submitUrl}
        className="bg-white p-4 rounded-xl shadow-sm space-y-3"
      >
        <h3 className="font-semibold">1. 貼網址爬取</h3>
        <p className="text-xs text-slate-500">
          目前支援：iCook 食譜頁（例如 https://icook.tw/recipes/391516）、Subway 營養頁
        </p>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          disabled={loading}
        />
        <button
          disabled={loading}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "爬取中…" : "開始爬取"}
        </button>
      </form>

      <section className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <h3 className="font-semibold">2. 品牌模板（一鍵更新）</h3>
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border rounded-lg px-3 py-2"
            >
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-slate-500">{t.base_url}</p>
              </div>
              <button
                disabled={loading}
                onClick={() => runTemplate(t.id)}
                className="text-sm bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-700 disabled:opacity-50"
              >
                一鍵更新
              </button>
            </div>
          ))}
        </div>
      </section>

      {activeJob && (
        <section className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <h3 className="font-semibold">本次爬取結果</h3>
          <p className="text-sm text-slate-600">
            狀態：{statusLabel(activeJob.job.status)} · 結果數：
            {activeJob.results.length}
          </p>
          {activeJob.results.length === 0 && activeJob.job.status === "completed" && (
            <p className="text-sm text-amber-700">
              有跑完但沒抓到資料。可能是網頁結構變更，或此網域尚未支援。
            </p>
          )}
          <ul className="space-y-2">
            {activeJob.results.map((r) => (
              <li key={r.id} className="border rounded-lg px-3 py-2 text-sm">
                <p className="font-medium">{r.parsed_name || "（無名稱）"}</p>
                <p className="text-slate-500">
                  熱量 {r.parsed_calories ?? "—"} · 蛋白質 {r.parsed_protein ?? "—"} · AI{" "}
                  {r.ai_confidence}（{r.ai_notes}）
                </p>
                {r.raw_data?.ingredients && (
                  <p className="text-xs text-slate-400 mt-1">
                    食材：{r.raw_data.ingredients.slice(0, 6).join("、")}
                    {r.raw_data.ingredients.length > 6 ? "…" : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {activeJob.results.length > 0 && (
            <Link
              to="/review"
              className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              去審核佇列通過入庫
            </Link>
          )}
        </section>
      )}

      <section className="bg-white p-4 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-2">最近任務</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">尚無任務</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">狀態</th>
                <th>URL</th>
                <th>結果數</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="py-2">{statusLabel(j.status)}</td>
                  <td className="truncate max-w-md">{j.url}</td>
                  <td>{j.result_count}</td>
                  <td>
                    <button
                      className="text-emerald-700 underline"
                      onClick={() =>
                        api<JobDetail>(`/api/scrape/jobs/${j.id}`).then(setActiveJob)
                      }
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
