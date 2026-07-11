import json
from urllib.parse import urlparse

from server.db.connection import SessionLocal
from server.db.models import ScrapeJob, ScrapeResult, ScraperTemplate, new_id, utcnow
from pipeline.scrapers.icook import fetch_icook_recipe
from pipeline.scrapers.subway import fetch_subway_nutrition


def ai_review_item(item: dict) -> tuple[str, str]:
    """Lightweight rule-based pre-review (Gemini can replace later)."""
    name = item.get("parsed_name") or item.get("title")
    cal = item.get("calories_kcal")
    notes = []

    if not name:
        return "low", "缺少品項名稱"

    if cal is not None:
        if cal < 0 or cal > 5000:
            notes.append(f"熱量異常: {cal}")
        if cal > 0:
            return ("high" if not notes else "medium"), "; ".join(notes) or "欄位完整"

    if item.get("type") == "icook_recipe":
        return "medium", "食譜資料，待 TFDA 推算營養"

    return "low", "; ".join(notes) or "缺少營養數值"


def _resolve_scraper_type(job: ScrapeJob, template: ScraperTemplate | None, url: str) -> str:
    if template:
        return template.config_dict().get("type", "")
    host = urlparse(url).netloc.lower()
    if "icook.tw" in host:
        return "icook_recipe"
    if "subway.com" in host:
        return "subway_nutrition"
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
                payload = fetch_icook_recipe(url)
                rows = [payload]
            elif scraper_type == "subway_nutrition":
                rows = fetch_subway_nutrition(url)
            else:
                raise ValueError(f"不支援的爬蟲類型或網域: {url}")

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
