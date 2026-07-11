import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from server.api.routes import router
from server.db.connection import SessionLocal, engine, init_sqlite_schema
from server.db.models import Base
from server.db.seed import seed_defaults

static_dir = Path(__file__).resolve().parents[2] / "admin" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    init_sqlite_schema()
    _ensure_columns()
    db = SessionLocal()
    try:
        seed_defaults(db)
    finally:
        db.close()
    yield


def _ensure_columns():
    from sqlalchemy import text, inspect

    insp = inspect(engine)
    if "menu_items" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("menu_items")}
    with engine.begin() as conn:
        if "image_url" not in cols:
            conn.execute(text("ALTER TABLE menu_items ADD COLUMN image_url VARCHAR"))


app = FastAPI(
    title="Eat AI Collector API",
    version="0.1.0",
    lifespan=lifespan,
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "service": "eat-ai-collector"}


def _serve_spa(path: str = ""):
    if not static_dir.exists():
        raise HTTPException(status_code=503, detail="Frontend not built")
    if path:
        file_path = static_dir / path
        if file_path.is_file():
            return FileResponse(file_path)
    index = static_dir / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=503, detail="Frontend not built")
    return FileResponse(index)


@app.get("/")
def serve_root():
    return _serve_spa()


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    return _serve_spa(full_path)
