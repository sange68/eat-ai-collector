import re
from typing import Any

from pipeline.enrichers.taiwan_food_db import lookup_per_100g

# Taiwan household measures (grams)
UNIT_TO_G = {
    "g": 1.0,
    "克": 1.0,
    "kg": 1000.0,
    "公斤": 1000.0,
    "匙": 15.0,
    "大匙": 15.0,
    "湯匙": 15.0,
    "茶匙": 5.0,
    "小匙": 5.0,
    "碗": 180.0,  # rice bowl approx for liquid/sauce
    "小飯碗": 180.0,
    "杯": 240.0,
    "顆": 10.0,  # default small item; overridden by ingredient
    "片": 1.0,
    "條": 80.0,
}


def _parse_amount_grams(name: str, unit_text: str) -> float | None:
    text = (unit_text or "").replace(" ", "")
    if not text:
        return None

    # e.g. 3條(約1000g) / 約1000g / 1000公克
    m = re.search(r"(?:約)?(\d+(?:\.\d+)?)\s*(?:g|克|公克)", text, re.I)
    if m:
        return float(m.group(1))

    m = re.search(r"(?:約)?(\d+(?:\.\d+)?)\s*(kg|公斤)", text, re.I)
    if m:
        return float(m.group(1)) * 1000

    # 2碗 / 1匙 / 3顆
    m = re.search(r"(\d+(?:\.\d+)?)\s*(大匙|湯匙|茶匙|小匙|匙|小飯碗|碗|杯|顆|片|條)", text)
    if m:
        qty = float(m.group(1))
        unit = m.group(2)
        base = UNIT_TO_G.get(unit, 10.0)
        # better defaults for named items
        if unit == "顆" and ("蒜" in name or "蔥" in name):
            base = 5.0
        if unit == "顆" and "八角" in name:
            base = 2.0
        if unit == "片" and "香葉" in name:
            base = 0.5
        if unit == "條" and "肉" in name:
            # if no grams given, assume larger strip
            base = 150.0
        return qty * base

    m = re.search(r"(\d+(?:\.\d+)?)", text)
    if m:
        return float(m.group(1))
    return None


def estimate_recipe_nutrition(ingredient_lines: list[str], servings: int = 8) -> dict[str, Any]:
    """
    Estimate dish nutrition from ingredient list.
    Returns per-serving macros + derivation details.
    """
    total = {"calories_kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    matched = []
    unmatched = []

    for line in ingredient_lines:
        # "豬五花肉 3條(約1000g)" or "豬五花肉　3條"
        parts = re.split(r"[\s　]+", line.strip(), maxsplit=1)
        name = parts[0] if parts else line
        unit = parts[1] if len(parts) > 1 else ""
        per100 = lookup_per_100g(name)
        grams = _parse_amount_grams(name, unit)
        if not per100 or not grams:
            unmatched.append(line)
            continue
        factor = grams / 100.0
        item = {
            "name": name,
            "grams": round(grams, 1),
            "kcal": round(per100[0] * factor, 1),
            "protein_g": round(per100[1] * factor, 1),
            "carbs_g": round(per100[2] * factor, 1),
            "fat_g": round(per100[3] * factor, 1),
        }
        matched.append(item)
        total["calories_kcal"] += item["kcal"]
        total["protein_g"] += item["protein_g"]
        total["carbs_g"] += item["carbs_g"]
        total["fat_g"] += item["fat_g"]

    servings = max(servings, 1)
    per_serving = {
        "calories_kcal": round(total["calories_kcal"] / servings, 1),
        "protein_g": round(total["protein_g"] / servings, 1),
        "carbs_g": round(total["carbs_g"] / servings, 1),
        "fat_g": round(total["fat_g"] / servings, 1),
        "servings": servings,
        "matched_ingredients": matched,
        "unmatched_ingredients": unmatched,
        "estimation_method": "taiwan_food_db_per_100g",
    }
    return per_serving
