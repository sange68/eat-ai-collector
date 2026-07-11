import re
from typing import Any

import requests
from bs4 import BeautifulSoup

from pipeline.enrichers.recipe_nutrition import estimate_recipe_nutrition

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) EatAI-Collector/1.1",
    "Accept-Language": "zh-TW,zh;q=0.9",
}

# Seed recipes for "一鍵更新" iCook template
ICOOK_SEED_URLS = [
    "https://icook.tw/recipes/391516",  # 滷肉飯
]


def fetch_icook_recipe(url: str) -> dict[str, Any]:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    title_tag = soup.select_one("h1#recipe-name")
    title = title_tag.get_text(strip=True) if title_tag else "（未取得標題）"

    ingredients: list[str] = []
    for li in soup.select("ul.ingredients li.ingredient"):
        name_tag = li.select_one(".ingredient-name")
        unit_tag = li.select_one(".ingredient-unit")
        name = name_tag.get_text(strip=True) if name_tag else ""
        unit = unit_tag.get_text(strip=True) if unit_tag else ""
        if name:
            ingredients.append(f"{name} {unit}".strip())

    image_url = None
    og = soup.select_one('meta[property="og:image"]')
    if og and og.get("content"):
        image_url = og["content"]

    # servings guess from page text
    servings = 8
    servings_el = soup.select_one(".servings, .recipe-detail-servings, [class*='serving']")
    if servings_el:
        m = re.search(r"(\d+)", servings_el.get_text())
        if m:
            servings = max(int(m.group(1)), 1)

    estimate = estimate_recipe_nutrition(ingredients, servings=servings)

    return {
        "type": "icook_recipe",
        "url": url,
        "title": title,
        "ingredients": ingredients,
        "brand": None,
        "category": "main",
        "data_line": "street_food",
        "data_source": "recipe_derived",
        "source_url": url,
        "image_url": image_url,
        "parsed_name": title,
        "calories_kcal": estimate["calories_kcal"],
        "protein_g": estimate["protein_g"],
        "carbs_g": estimate["carbs_g"],
        "fat_g": estimate["fat_g"],
        "servings": estimate["servings"],
        "nutrition_estimate": estimate,
        "price_twd": None,
    }


def fetch_icook_seed_batch() -> list[dict[str, Any]]:
    rows = []
    errors = []
    for url in ICOOK_SEED_URLS:
        try:
            rows.append(fetch_icook_recipe(url))
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    if not rows and errors:
        raise RuntimeError("; ".join(errors))
    return rows
