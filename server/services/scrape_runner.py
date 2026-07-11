import json
from urllib.parse import urlparse

from server.db.connection import SessionLocal
from server.db.models import ScrapeJob, ScrapeResult, ScraperTemplate, new_id, utcnow
from pipeline.scrapers.icook import fetch_icook_recipe, fetch_icook_seed_batch
from pipeline.scrapers.catalog import fetch_subway_catalog, fetch_mcdonalds_catalog


def ai_review_item(item: dict) -> tuple[str, str]:
    name = item.get("parsed_name") or item.get("title")
    cal = item.get("calories_kcal")
    notes = []

    if not name:
        return "low", "缺少品項名稱"

    if item.get("image_url"):
        notes.append("含圖片")

    if cal is not None:
        if cal < 0 or cal > 5000:
            notes.append(f"熱量異常: {cal}")
            return "low", "; ".join(notes)
        if item.get("data_source") == "official":
            return "high", "; ".join(notes) or "官方營養資料完整"
        if item.get("nutrition_estimate"):
            unmatched = item["nutrition_estimate"].get("unmatched_ingredients") or []
            if unmatched:
                notes.append(f"未匹配食材 {len(unmatched)} 項")
            notes.append("已由台灣食材庫估算每份營養")
            return "medium", "; ".join(notes)
        return "high", "; ".join(notes) or "欄位完整"

    if item.get("type") == "icook_recipe":
        return "low", "食譜已抓取，但營養估算失敗"

    return "low", "; ".join(notes) or "缺少營養數值"


def _resolve_scraper_type(job: ScrapeJob, template: ScraperTemplate | None, url: str) -> str:
    if template:
        return template.config_dict().get("type", "")
    host = urlparse(url or "").netloc.lower()
    path = urlparse(url or "").path
    if "icook.tw" in host:
        if path.rstrip("/").endswith("/recipes") or path.rstrip("/") == "/recipes":
            return "icook_seed_batch"
        return "icook_recipe"
    if "subway" in host:
        return "subway_catalog"
    if "mcdonalds" in host:
        return "mcdonalds_catalog"
    return ""


def run_scrape_job(job_id: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
        if not job:
            return

        job.status = "running"
        db.commit()

        template = None
        if job.template_id:
            template = (
                db.query(ScraperTemplate).filter(ScraperTemplate.id == job.template_id).first()
            )

        url = job.url or (template.base_url if template else "")
        scraper_type = _resolve_scraper_type(job, template, url)

        try:
            if scraper_type == "icook_recipe":
                rows = [fetch_icook_recipe(url)]
            elif scraper_type == "icook_seed_batch":
                rows = fetch_icook_seed_batch()
            elif scraper_type in ("subway_catalog", "subway_nutrition"):
                rows = fetch_subway_catalog()
            elif scraper_type == "mcdonalds_catalog":
                rows = fetch_mcdonalds_catalog()
            else:
                raise ValueError(
                    f"不支援的來源。請使用：iCook 食譜頁、Subway/McDonald's 模板。"
                    f" 目前 URL={url}"
                )

            for row in rows:
                confidence, notes = ai_review_item(row)
                db.add(
                    ScrapeResult(
                        id=new_id(),
                        job_id=job.id,
                        raw_data=json.dumps(row, ensure_ascii=False),
                        parsed_name=row.get("parsed_name") or row.get("title"),
                        parsed_calories=row.get("calories_kcal"),
                        parsed_protein=row.get("protein_g"),
                        parsed_carbs=row.get("carbs_g"),
                        parsed_fat=row.get("fat_g"),
                        ai_confidence=confidence,
                        ai_notes=notes,
                        review_status="pending",
                    )
                )

            job.status = "completed"
            job.result_count = len(rows)
            job.completed_at = utcnow()
            job.error_message = None
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = utcnow()

        db.commit()
    finally:
        db.close()
