import json
import os
from pathlib import Path
from typing import Any

import httpx

CATALOG_DIR = Path(__file__).resolve().parents[1] / "catalogs"
REGIONS_PATH = CATALOG_DIR / "taiwan_regions.json"
DEMO_PATH = CATALOG_DIR / "google_places_demo.json"
# backward compatible
LEGACY_DEMO = CATALOG_DIR / "google_places_demo_datong.json"

TYPE_MAP = {
    "燒烤店": "barbecue_restaurant",
    "火鍋": "restaurant",
    "牛肉麵": "restaurant",
    "小吃": "restaurant",
    "咖啡廳": "cafe",
    "餐廳": "restaurant",
}

TYPE_KEYWORDS = {
    "燒烤店": ["烤", "燒肉", "barbecue", "炭火"],
    "火鍋": ["鍋", "涮涮", "麻辣"],
    "牛肉麵": ["牛肉麵", "牛肉面"],
    "小吃": ["夜市", "小吃", "雞排", "滷味", "鹹酥雞"],
    "餐廳": [],
}


def load_regions() -> dict[str, Any]:
    return json.loads(REGIONS_PATH.read_text(encoding="utf-8"))


def build_area_label(city: str, district: str = "", neighborhood: str = "") -> str:
    parts = [p for p in [city, district, neighborhood] if p and p != "全部"]
    return "".join(parts) if parts else "台灣"


def _demo_dataset() -> list[dict[str, Any]]:
    path = DEMO_PATH if DEMO_PATH.exists() else LEGACY_DEMO
    return json.loads(path.read_text(encoding="utf-8"))


def load_demo_places(
    city: str = "台北市",
    district: str = "",
    neighborhood: str = "",
    place_type: str = "燒烤店",
    min_reviews: int = 50,
) -> list[dict[str, Any]]:
    data = _demo_dataset()
    area = build_area_label(city, district, neighborhood)
    results = []

    for p in data:
        if p.get("user_rating_count", 0) < min_reviews:
            continue
        if city and p.get("city") and p["city"] != city:
            # legacy rows without city: keep if area text matches
            if "city" in p and p["city"] != city:
                continue
        if district and district != "全部":
            if p.get("district") and p["district"] != district:
                continue
            if not p.get("district") and district not in (p.get("address") or ""):
                continue
        if neighborhood and neighborhood != "全部":
            if p.get("neighborhood") and p["neighborhood"] != neighborhood:
                continue
            # allow address/summary contains neighborhood keyword
            blob = f"{p.get('name','')}{p.get('address','')}{p.get('review_summary','')}"
            if p.get("neighborhood") != neighborhood and neighborhood not in blob:
                continue

        if not _match_type(p, place_type):
            continue

        results.append(
            {
                **p,
                "area": area,
                "city": p.get("city") or city,
                "district": p.get("district") or district,
                "neighborhood": p.get("neighborhood") or neighborhood,
                "demo": True,
            }
        )

    # progressive fallback: drop neighborhood -> district -> type-only in city
    if not results and neighborhood and neighborhood != "全部":
        return load_demo_places(city, district, "全部", place_type, min_reviews)
    if not results and district and district != "全部":
        return load_demo_places(city, "全部", "全部", place_type, min_reviews)
    if not results:
        # last resort: same city any type above min reviews
        for p in data:
            if p.get("user_rating_count", 0) < min_reviews:
                continue
            if p.get("city") and city and p["city"] != city:
                continue
            results.append({**p, "area": area, "demo": True})
    return results


def _match_type(place: dict[str, Any], place_type: str) -> bool:
    if place_type == "餐廳" or not place_type:
        return True
    keywords = TYPE_KEYWORDS.get(place_type, [])
    primary = place.get("primary_type") or ""
    mapped = TYPE_MAP.get(place_type, "")
    if mapped and mapped in primary:
        return True
    blob = f"{place.get('name','')}{place.get('review_summary','')}{place.get('types','')}"
    return any(k in blob for k in keywords) if keywords else True


def search_places(
    city: str = "台北市",
    district: str = "",
    neighborhood: str = "",
    place_type: str = "燒烤店",
    min_reviews: int = 50,
    min_rating: float = 0.0,
    area: str | None = None,
) -> dict[str, Any]:
    """
    Search restaurants with structured Taiwan location.
    Uses Google Places API if GOOGLE_PLACES_API_KEY is set; otherwise demo data.
    """
    area_label = area or build_area_label(city, district, neighborhood)
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()

    if not api_key:
        places = load_demo_places(city, district, neighborhood, place_type, min_reviews)
        places = [p for p in places if (p.get("rating") or 0) >= min_rating]
        return {
            "mode": "demo",
            "message": (
                f"示範模式：依「{area_label}」篩選內建台灣餐廳樣本。"
                "設定 GOOGLE_PLACES_API_KEY 後可改為 Google 正式搜尋。"
            ),
            "query": {
                "city": city,
                "district": district,
                "neighborhood": neighborhood,
                "place_type": place_type,
                "area": area_label,
                "min_reviews": min_reviews,
            },
            "places": places,
            "count": len(places),
            "type_breakdown": _breakdown(places),
        }

    text_query = f"{place_type} {area_label}".strip()
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,places.rating,"
            "places.userRatingCount,places.types,places.primaryType,places.priceLevel,"
            "places.reviewSummary"
        ),
    }
    payload = {"textQuery": text_query, "languageCode": "zh-TW", "regionCode": "TW"}
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    places = []
    for p in data.get("places", []):
        count = p.get("userRatingCount") or 0
        rating = p.get("rating") or 0
        if count < min_reviews or rating < min_rating:
            continue
        summary = None
        if p.get("reviewSummary") and p["reviewSummary"].get("text"):
            summary = p["reviewSummary"]["text"].get("text")
        places.append(
            {
                "place_id": p.get("id"),
                "name": (p.get("displayName") or {}).get("text"),
                "address": p.get("formattedAddress"),
                "rating": rating,
                "user_rating_count": count,
                "primary_type": p.get("primaryType"),
                "types": p.get("types") or [],
                "review_summary": summary,
                "menu_hints": [],
                "demo": False,
                "area": area_label,
                "city": city,
                "district": district,
                "neighborhood": neighborhood,
            }
        )

    return {
        "mode": "live",
        "message": f"Google Places 搜尋「{text_query}」",
        "query": {
            "city": city,
            "district": district,
            "neighborhood": neighborhood,
            "place_type": place_type,
            "area": area_label,
            "min_reviews": min_reviews,
        },
        "places": places,
        "count": len(places),
        "type_breakdown": _breakdown(places),
    }


def _breakdown(places: list[dict[str, Any]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for p in places:
        key = p.get("primary_type") or "unknown"
        out[key] = out.get(key, 0) + 1
    return out
