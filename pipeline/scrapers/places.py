import json
import os
from pathlib import Path
from typing import Any

import httpx

DEMO_PATH = Path(__file__).resolve().parents[1] / "catalogs" / "google_places_demo_datong.json"

TYPE_MAP = {
    "燒烤店": "barbecue_restaurant",
    "火鍋": "restaurant",
    "牛肉麵": "restaurant",
    "小吃": "restaurant",
    "咖啡廳": "cafe",
    "餐廳": "restaurant",
}


def load_demo_places(
    area: str = "台北市大同區",
    place_type: str = "燒烤店",
    min_reviews: int = 50,
) -> list[dict[str, Any]]:
    data = json.loads(DEMO_PATH.read_text(encoding="utf-8"))
    type_key = TYPE_MAP.get(place_type, "restaurant")
    results = []
    for p in data:
        if p.get("user_rating_count", 0) < min_reviews:
            continue
        # soft filter by type keyword
        if place_type == "燒烤店" and "barbecue" not in (p.get("primary_type") or ""):
            # still include if summary mentions 烤
            if "烤" not in (p.get("review_summary") or "") and "barbecue" not in str(p.get("types")):
                continue
        if place_type == "火鍋" and "鍋" not in p.get("name", "") and "鍋" not in (p.get("review_summary") or ""):
            continue
        if place_type == "牛肉麵" and "牛肉麵" not in p.get("name", "") and "牛肉麵" not in (p.get("review_summary") or ""):
            continue
        results.append({**p, "area": area, "demo": True})
    # if filter too strict, return all above min_reviews
    if not results:
        results = [{**p, "area": area, "demo": True} for p in data if p.get("user_rating_count", 0) >= min_reviews]
    return results


def search_places(
    area: str,
    place_type: str,
    min_reviews: int = 50,
    min_rating: float = 0.0,
) -> dict[str, Any]:
    """
    Search restaurants. Uses Google Places API if GOOGLE_PLACES_API_KEY is set,
    otherwise returns Taiwan demo dataset.
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not api_key:
        places = load_demo_places(area, place_type, min_reviews)
        places = [p for p in places if (p.get("rating") or 0) >= min_rating]
        return {
            "mode": "demo",
            "message": "尚未設定 GOOGLE_PLACES_API_KEY，目前顯示大同區示範資料。可在 Railway 環境變數加入金鑰啟用正式搜尋。",
            "places": places,
            "count": len(places),
            "type_breakdown": _breakdown(places),
        }

    text_query = f"{place_type} {area}"
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
                "area": area,
            }
        )

    return {
        "mode": "live",
        "message": "Google Places API 即時搜尋結果",
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
