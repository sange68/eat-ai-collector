import re
from typing import Any

import requests
from bs4 import BeautifulSoup

REQUEST_HEADERS = {
    "User-Agent": "EatAI-Collector/1.0 (+research; nutrition data collection)",
    "Accept-Language": "zh-TW,zh;q=0.9",
}


def _parse_float(text: str) -> float | None:
    if not text:
        return None
    m = re.search(r"[\d.]+", text.replace(",", ""))
    return float(m.group()) if m else None


def fetch_subway_nutrition(url: str | None = None) -> list[dict[str, Any]]:
    target = url or "https://www.subway.com/zh-TW/menunutrition"
    response = requests.get(target, headers=REQUEST_HEADERS, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    items: list[dict[str, Any]] = []

    for table in soup.select("table"):
        headers = [th.get_text(strip=True).lower() for th in table.select("thead th")]
        if not headers:
            headers = [th.get_text(strip=True).lower() for th in table.select("tr th")]
        if not any("cal" in h or "熱量" in h or "kcal" in h for h in headers):
            continue
        for row in table.select("tbody tr"):
            cells = [td.get_text(strip=True) for td in row.select("td")]
            if len(cells) < 2:
                continue
            name = cells[0]
            if not name or name.lower() in ("product", "item", "品項"):
                continue
            cal = pro = carb = fat = None
            for idx, header in enumerate(headers[1:], start=1):
                if idx >= len(cells):
                    break
                val = _parse_float(cells[idx])
                if val is None:
                    continue
                if "cal" in header or "熱量" in header or "kcal" in header:
                    cal = val
                elif "prot" in header or "蛋白" in header:
                    pro = val
                elif "carb" in header or "碳水" in header:
                    carb = val
                elif "fat" in header or "脂肪" in header:
                    fat = val
            items.append(_item(name, target, cal, pro, carb, fat))

    if not items:
        for block in soup.select("[class*='nutrition'], [class*='menu'], article, li"):
            text = block.get_text(" ", strip=True)
            if len(text) < 10 or len(text) > 500:
                continue
            name_el = block.select_one("h2, h3, h4, strong, .title")
            name = name_el.get_text(strip=True) if name_el else None
            if not name:
                continue
            cal_m = re.search(r"(\d+)\s*(?:kcal|大卡|Cal)", text, re.I)
            pro_m = re.search(r"(\d+(?:\.\d+)?)\s*g?\s*(?:蛋白|protein)", text, re.I)
            if not cal_m and not pro_m:
                continue
            items.append(
                _item(
                    name,
                    target,
                    float(cal_m.group(1)) if cal_m else None,
                    float(pro_m.group(1)) if pro_m else None,
                    None,
                    None,
                )
            )

    seen: set[str] = set()
    unique = []
    for item in items:
        key = item["parsed_name"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _item(name, target, cal, pro, carb, fat) -> dict[str, Any]:
    return {
        "type": "subway_nutrition",
        "parsed_name": name,
        "brand": "Subway",
        "category": "main",
        "data_line": "convenience_chain",
        "data_source": "official",
        "source_url": target,
        "url": target,
        "calories_kcal": cal,
        "protein_g": pro,
        "carbs_g": carb,
        "fat_g": fat,
    }
