import re
from typing import Any

import requests
from bs4 import BeautifulSoup

REQUEST_HEADERS = {
    "User-Agent": "EatAI-Collector/1.0 (+research; nutrition data collection)",
    "Accept-Language": "zh-TW,zh;q=0.9",
}


def fetch_icook_recipe(url: str) -> dict[str, Any]:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=15)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    title_tag = soup.select_one("h1#recipe-name")
    title = title_tag.get_text(strip=True) if title_tag else "（未取得標題）"

    ingredients = []
    for li in soup.select("ul.ingredients li.ingredient"):
        name_tag = li.select_one(".ingredient-name")
        unit_tag = li.select_one(".ingredient-unit")
        name = name_tag.get_text(strip=True) if name_tag else ""
        unit = unit_tag.get_text(strip=True) if unit_tag else ""
        if name:
            ingredients.append(f"{name} {unit}".strip())

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
        "parsed_name": title,
        "calories_kcal": None,
        "protein_g": None,
        "carbs_g": None,
        "fat_g": None,
    }
