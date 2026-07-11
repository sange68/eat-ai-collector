import { FormEvent, useEffect, useState } from "react";
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
  error_message?: string;
};

export default function Workbench() {
  const [url, setUrl] = useState("https://icook.tw/recipes/391516");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");

  const load = () => {
    api<Template[]>("/api/templates").then(setTemplates).catch(console.error);
    api<Job[]>("/api/scrape/jobs").then(setJobs).catch(console.error);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const submitUrl = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      await api("/api/scrape/jobs", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setMessage("已建立爬蟲任務");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "失敗");
    }
  };

  const runTemplate = async (templateId: string) => {
    setMessage("");
    try {
      await api(`/api/scrape/templates/${templateId}/run`, { method: "POST" });
      setMessage("已觸發模板更新");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "失敗");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">URL 工作台</h2>
      {message && <p className="text-emerald-700 text-sm">{message}</p>}

      <form onSubmit={submitUrl} className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <h3 className="font-semibold">貼網址爬取</h3>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
          開始爬取
        </button>
      </form>

      <section className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <h3 className="font-semibold">品牌模板（一鍵更新）</h3>
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-slate-500">{t.base_url}</p>
              </div>
              <button
                onClick={() => runTemplate(t.id)}
                className="text-sm bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-700"
              >
                一鍵更新
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-4 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-2">最近任務</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">狀態</th>
              <th>URL</th>
              <th>結果數</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t">
                <td className="py-2">{j.status}</td>
                <td className="truncate max-w-md">{j.url}</td>
                <td>{j.result_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
