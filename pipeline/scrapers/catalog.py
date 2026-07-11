import json
from pathlib import Path
from typing import Any

CATALOG_DIR = Path(__file__).resolve().parents[1] / "catalogs"


def load_catalog(name: str) -> list[dict[str, Any]]:
    path = CATALOG_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"找不到目錄檔：{name}")
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for item in data:
        rows.append(
            {
                "type": "official_catalog",
                "parsed_name": item["parsed_name"],
                "brand": item.get("brand"),
                "category": item.get("category", "main"),
                "data_line": "convenience_chain",
                "data_source": item.get("data_source", "official"),
                "source_url": item.get("source_url") or f"catalog://{name}",
                "url": item.get("source_url") or f"catalog://{name}",
                "image_url": item.get("image_url"),
                "calories_kcal": item.get("calories_kcal"),
                "protein_g": item.get("protein_g"),
                "carbs_g": item.get("carbs_g"),
                "fat_g": item.get("fat_g"),
                "price_twd": item.get("price_twd"),
                "notes": item.get("notes"),
            }
        )
    return rows


def fetch_subway_catalog() -> list[dict[str, Any]]:
    return load_catalog("subway_tw.json")


def fetch_mcdonalds_catalog() -> list[dict[str, Any]]:
    return load_catalog("mcdonalds_tw.json")
