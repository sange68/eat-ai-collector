import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  PLACE_TYPES,
  TAIWAN_REGIONS,
  buildAreaLabel,
} from "../data/taiwanRegions";

type Place = {
  place_id: string;
  name: string;
  address?: string;
  rating?: number;
  user_rating_count?: number;
  primary_type?: string;
  review_summary?: string;
  menu_hints?: string[];
  city?: string;
  district?: string;
  neighborhood?: string;
  demo?: boolean;
};

type SearchResponse = {
  mode: string;
  message: string;
  count: number;
  places: Place[];
  type_breakdown: Record<string, number>;
  query?: {
    city?: string;
    district?: string;
    neighborhood?: string;
    area?: string;
  };
};

export default function GoogleExplorer() {
  const [city, setCity] = useState("台北市");
  const [district, setDistrict] = useState("大同區");
  const [neighborhood, setNeighborhood] = useState("全部");
  const [placeType, setPlaceType] = useState("燒烤店");
  const [minReviews, setMinReviews] = useState(50);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const cityObj = useMemo(
    () => TAIWAN_REGIONS.find((c) => c.name === city) || TAIWAN_REGIONS[0],
    [city]
  );
  const districts = cityObj.districts;
  const districtObj = useMemo(
    () => districts.find((d) => d.name === district) || districts[0],
    [districts, district]
  );
  const neighborhoods = districtObj?.neighborhoods || [];

  // reset dependent selects when parent changes
  useEffect(() => {
    if (!districts.some((d) => d.name === district)) {
      setDistrict(districts[0]?.name || "全部");
    }
  }, [city, districts, district]);

  useEffect(() => {
    if (neighborhood !== "全部" && !neighborhoods.includes(neighborhood)) {
      setNeighborhood("全部");
    }
  }, [district, neighborhoods, neighborhood]);

  const areaLabel = buildAreaLabel(city, district, neighborhood);

  const selectedPlaces = useMemo(
    () => (result?.places || []).filter((p) => selected[p.place_id]),
    [result, selected]
  );

  const search = async () => {
    if (!city || !district) {
      setError("請先選擇城市與行政區");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    setSearched(true);
    try {
      const data = await api<SearchResponse>("/api/places/search", {
        method: "POST",
        body: JSON.stringify({
          city,
          district,
          neighborhood,
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
      if (data.count === 0) {
        setMessage(`「${areaLabel}」＋「${placeType}」目前沒有符合條件的結果，可放寬評論數或改選「全部」街區。`);
      } else {
        setMessage(`找到 ${data.count} 家（${areaLabel}）。${data.message}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜尋失敗");
      setResult(null);
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

  const toggleAll = (checked: boolean) => {
    if (!result) return;
    const next: Record<string, boolean> = {};
    result.places.forEach((p) => {
      next[p.place_id] = checked;
    });
    setSelected(next);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">② Google 餐廳探索</h2>
        <p className="text-sm text-slate-600 mt-1">
          依序點選：城市 → 行政區 → 街區/商圈 → 餐廳類型 → 搜尋 → 勾選匯入。
        </p>
      </div>

      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2 text-xs">
        {[
          "1.選城市",
          "2.選行政區",
          "3.選街區",
          "4.選類型",
          "5.搜尋",
          "6.勾選匯入",
        ].map((step) => (
          <li
            key={step}
            className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full"
          >
            {step}
          </li>
        ))}
      </ol>

      {message && (
        <p className="text-emerald-800 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {message}{" "}
          {message.includes("審核") && (
            <Link className="underline font-medium" to="/review">
              去審核 →
            </Link>
          )}
        </p>
      )}
      {error && (
        <p className="text-red-700 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <section className="bg-white p-4 rounded-xl shadow-sm space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm font-medium">
            城市 / 縣市
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setResult(null);
                setSearched(false);
              }}
            >
              {TAIWAN_REGIONS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            鄉鎮市區
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setNeighborhood("全部");
                setResult(null);
                setSearched(false);
              }}
            >
              {districts.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            街區 / 商圈
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
              value={neighborhood}
              onChange={(e) => {
                setNeighborhood(e.target.value);
                setResult(null);
                setSearched(false);
              }}
            >
              <option value="全部">全部街區</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Quick neighborhood chips */}
        <div>
          <p className="text-xs text-slate-500 mb-2">快捷街區（點一下即可）</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setNeighborhood("全部");
                setResult(null);
              }}
              className={`text-xs px-3 py-1 rounded-full border ${
                neighborhood === "全部"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700"
              }`}
            >
              全部
            </button>
            {neighborhoods.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setNeighborhood(n);
                  setResult(null);
                }}
                className={`text-xs px-3 py-1 rounded-full border ${
                  neighborhood === n
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 items-end">
          <label className="text-sm font-medium">
            餐廳類型
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
              value={placeType}
              onChange={(e) => setPlaceType(e.target.value)}
            >
              {PLACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            最低評論數
            <input
              type="number"
              min={0}
              className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
              value={minReviews}
              onChange={(e) => setMinReviews(Number(e.target.value) || 0)}
            />
          </label>
          <button
            disabled={loading}
            onClick={search}
            className="w-full bg-emerald-600 text-white rounded-lg px-3 py-2.5 disabled:opacity-50"
          >
            {loading ? "搜尋中…" : `搜尋：${areaLabel}`}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          目前條件：<b>{areaLabel || "（未選）"}</b> · {placeType} · 評論 ≥ {minReviews}
        </p>
      </section>

      {!searched && !result && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
          請先完成上方點選，再按「搜尋」。示範資料目前以台北市較完整，其他城市也可選（無資料時會提示）。
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl p-6 shadow-sm text-sm text-slate-500">
          正在依「{areaLabel}」搜尋餐廳…
        </div>
      )}

      {result && !loading && (
        <section className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              搜尋結果（{result.count}）·{" "}
              {result.mode === "demo" ? "示範資料" : "Google 正式"}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-sm border px-3 py-1.5 rounded-lg"
                onClick={() => toggleAll(true)}
              >
                全選
              </button>
              <button
                type="button"
                className="text-sm border px-3 py-1.5 rounded-lg"
                onClick={() => toggleAll(false)}
              >
                取消全選
              </button>
              <button
                disabled={loading || selectedPlaces.length === 0}
                onClick={importSelected}
                className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
              >
                匯入已勾選（{selectedPlaces.length}）
              </button>
            </div>
          </div>

          {result.count === 0 ? (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-4">
              沒有符合的餐廳。建議：
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>街區改選「全部街區」</li>
                <li>類型改「餐廳」或「小吃」</li>
                <li>把最低評論數降到 0～30</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              {result.places.map((p) => (
                <label
                  key={p.place_id}
                  className="flex gap-3 border rounded-lg p-3 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!selected[p.place_id]}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [p.place_id]: e.target.checked,
                      }))
                    }
                  />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.name}{" "}
                      <span className="text-xs text-slate-500">
                        ★{p.rating ?? "—"} · {p.user_rating_count ?? 0} 則
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {[p.city, p.district, p.neighborhood].filter(Boolean).join(" · ")}
                      {p.address ? ` · ${p.address}` : ""}
                    </p>
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
          )}
        </section>
      )}
    </div>
  );
}
