import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, field_serializer
from sqlalchemy import func
from sqlalchemy.orm import Session

from server.api.auth import LoginRequest, TokenResponse, create_access_token, get_current_user, require_role, verify_password
from server.db.connection import get_db
from server.db.models import MenuItem, ScrapeJob, ScrapeResult, ScraperTemplate, User, new_id
from server.services.scrape_runner import run_scrape_job

router = APIRouter()


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    price_twd: Optional[int] = None
    calories_kcal: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    data_line: Optional[str] = None
    data_source: Optional[str] = None
    data_confidence: Optional[str] = None
    source_url: Optional[str] = None


class StatsOut(BaseModel):
    total_items: int
    by_confidence: dict
    by_brand: dict
    pending_reviews: int


class ScrapeJobCreate(BaseModel):
    url: str
    template_id: Optional[str] = None


class ScrapeJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    url: Optional[str] = None
    template_id: Optional[str] = None
    status: str
    result_count: int = 0
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None

    @field_serializer("created_at")
    def serialize_created_at(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    domain: str
    base_url: str
    is_active: bool


class ReviewResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str
    parsed_name: Optional[str] = None
    parsed_calories: Optional[float] = None
    parsed_protein: Optional[float] = None
    parsed_carbs: Optional[float] = None
    parsed_fat: Optional[float] = None
    ai_confidence: Optional[str] = None
    ai_notes: Optional[str] = None
    review_status: str
    raw_data: Optional[Any] = None

    @field_serializer("raw_data")
    def serialize_raw(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {"raw": value}
        return value


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    token = create_access_token(user.email, user.role)
    return TokenResponse(access_token=token, email=user.email, role=user.role)


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"email": user.email, "role": user.role, "display_name": user.display_name}


@router.get("/items", response_model=list[MenuItemOut])
def list_items(
    brand: Optional[str] = None,
    data_line: Optional[str] = None,
    data_confidence: Optional[str] = None,
    max_calories: Optional[float] = None,
    min_protein: Optional[float] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(MenuItem)
    if brand:
        q = q.filter(MenuItem.brand == brand)
    if data_line:
        q = q.filter(MenuItem.data_line == data_line)
    if data_confidence:
        q = q.filter(MenuItem.data_confidence == data_confidence)
    if max_calories is not None:
        q = q.filter(MenuItem.calories_kcal <= max_calories)
    if min_protein is not None:
        q = q.filter(MenuItem.protein_g >= min_protein)
    return q.order_by(MenuItem.updated_at.desc()).limit(limit).all()


@router.get("/items/{item_id}", response_model=MenuItemOut)
def get_item(item_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="品項不存在")
    return item


@router.get("/brands")
def list_brands(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    rows = (
        db.query(MenuItem.brand, func.count(MenuItem.id))
        .filter(MenuItem.brand.isnot(None))
        .group_by(MenuItem.brand)
        .all()
    )
    return [{"brand": brand, "count": count} for brand, count in rows]


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    total = db.query(func.count(MenuItem.id)).scalar() or 0
    conf_rows = (
        db.query(MenuItem.data_confidence, func.count(MenuItem.id))
        .group_by(MenuItem.data_confidence)
        .all()
    )
    brand_rows = (
        db.query(MenuItem.brand, func.count(MenuItem.id))
        .filter(MenuItem.brand.isnot(None))
        .group_by(MenuItem.brand)
        .limit(20)
        .all()
    )
    pending = (
        db.query(func.count(ScrapeResult.id))
        .filter(ScrapeResult.review_status == "pending")
        .scalar()
        or 0
    )
    return StatsOut(
        total_items=total,
        by_confidence={k or "unknown": v for k, v in conf_rows},
        by_brand={k: v for k, v in brand_rows},
        pending_reviews=pending,
    )


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return db.query(ScraperTemplate).filter(ScraperTemplate.is_active.is_(True)).all()


@router.post("/scrape/jobs", response_model=ScrapeJobOut)
def create_scrape_job(
    body: ScrapeJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = ScrapeJob(
        id=new_id(),
        url=body.url,
        template_id=body.template_id,
        status="pending",
        triggered_by=user.email,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_scrape_job, job.id)
    return job


@router.post("/scrape/templates/{template_id}/run", response_model=ScrapeJobOut)
def run_template(
    template_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "reviewer")),
):
    tpl = db.query(ScraperTemplate).filter(ScraperTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    job = ScrapeJob(
        id=new_id(),
        url=tpl.base_url,
        template_id=tpl.id,
        status="pending",
        triggered_by=user.email,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_scrape_job, job.id)
    return job


@router.get("/scrape/jobs", response_model=list[ScrapeJobOut])
def list_jobs(
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return db.query(ScrapeJob).order_by(ScrapeJob.created_at.desc()).limit(limit).all()


@router.get("/scrape/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任務不存在")
    results = db.query(ScrapeResult).filter(ScrapeResult.job_id == job_id).all()
    return {
        "job": ScrapeJobOut.model_validate(job),
        "results": [ReviewResultOut.model_validate(r) for r in results],
    }


@router.get("/review/queue", response_model=list[ReviewResultOut])
def review_queue(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "reviewer")),
):
    return (
        db.query(ScrapeResult)
        .filter(ScrapeResult.review_status == "pending")
        .order_by(ScrapeResult.created_at.asc())
        .limit(limit)
        .all()
    )


@router.post("/review/{result_id}/approve")
def approve_result(
    result_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "reviewer")),
):
    result = db.query(ScrapeResult).filter(ScrapeResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="審核項目不存在")
    if not result.parsed_name:
        raise HTTPException(status_code=400, detail="缺少品項名稱，無法發布")

    raw = {}
    try:
        raw = json.loads(result.raw_data or "{}")
    except json.JSONDecodeError:
        pass

    item = MenuItem(
        id=new_id(),
        name=result.parsed_name,
        brand=raw.get("brand"),
        category=raw.get("category", "main"),
        calories_kcal=result.parsed_calories,
        protein_g=result.parsed_protein,
        carbs_g=result.parsed_carbs,
        fat_g=result.parsed_fat,
        data_line=raw.get("data_line", "convenience_chain"),
        data_source=raw.get("data_source", "official"),
        data_confidence=result.ai_confidence or "high",
        source_url=raw.get("source_url") or raw.get("url"),
        derivation_path=json.dumps(raw, ensure_ascii=False),
    )
    result.review_status = "approved"
    db.add(item)
    db.commit()
    return {"status": "approved", "menu_item_id": item.id}


@router.post("/review/{result_id}/reject")
def reject_result(
    result_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "reviewer")),
):
    result = db.query(ScrapeResult).filter(ScrapeResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="審核項目不存在")
    result.review_status = "rejected"
    db.commit()
    return {"status": "rejected"}
