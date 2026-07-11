import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.types import TypeDecorator

from server.db.connection import Base


class GUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        return value


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=new_id)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    display_name = Column(String)
    created_at = Column(DateTime, default=utcnow)


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(GUID, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    brand = Column(String)
    category = Column(String)
    price_twd = Column(Integer)
    calories_kcal = Column(Float)
    protein_g = Column(Float)
    carbs_g = Column(Float)
    fat_g = Column(Float)
    data_line = Column(String)
    data_source = Column(String)
    data_confidence = Column(String)
    source_url = Column(String)
    barcode = Column(String)
    image_url = Column(String)
    derivation_path = Column(Text)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    created_at = Column(DateTime, default=utcnow)


class ScraperTemplate(Base):
    __tablename__ = "scraper_templates"

    id = Column(GUID, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    config = Column(Text, default="{}")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    def config_dict(self) -> dict:
        try:
            return json.loads(self.config or "{}")
        except json.JSONDecodeError:
            return {}


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"

    id = Column(GUID, primary_key=True, default=new_id)
    url = Column(String)
    template_id = Column(GUID)
    status = Column(String, default="pending")
    triggered_by = Column(String)
    result_count = Column(Integer, default=0)
    error_message = Column(Text)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime)


class ScrapeResult(Base):
    __tablename__ = "scrape_results"

    id = Column(GUID, primary_key=True, default=new_id)
    job_id = Column(GUID, nullable=False)
    raw_data = Column(Text, nullable=False)
    parsed_name = Column(String)
    parsed_calories = Column(Float)
    parsed_protein = Column(Float)
    parsed_carbs = Column(Float)
    parsed_fat = Column(Float)
    ai_confidence = Column(String)
    ai_notes = Column(Text)
    review_status = Column(String, default="pending")
    created_at = Column(DateTime, default=utcnow)


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(GUID, primary_key=True, default=new_id)
    contributor_email = Column(String)
    payload = Column(Text, nullable=False)
    review_status = Column(String, default="pending")
    reviewer_notes = Column(Text)
    created_at = Column(DateTime, default=utcnow)
