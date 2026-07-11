import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server.api.routes import router
from server.db.connection import init_sqlite_schema
from server.db.connection import SessionLocal
from server.db.models import Base
from server.db.connection import engine
from server.db.seed import seed_defaults


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    init_sqlite_schema()
    db = SessionLocal()
    try:
        seed_defaults(db)
    finally:
        db.close()
    yield


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

static_dir = Path(__file__).resolve().parents[2] / "admin" / "dist"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


@app.get("/health")
def health():
    return {"status": "ok", "service": "eat-ai-collector"}
