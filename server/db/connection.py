import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

load_dotenv()

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL", "")
SQLITE_PATH = os.getenv("SQLITE_PATH", str(Path(__file__).resolve().parents[2] / "data" / "eat_ai.db"))


def _build_engine():
    if DATABASE_URL:
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return create_engine(url, pool_pre_ping=True)
    Path(SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{SQLITE_PATH}", connect_args={"check_same_thread": False})


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_sqlite_schema():
    """Bootstrap SQLite schema for local dev when DATABASE_URL is not set."""
    if DATABASE_URL:
        return
    schema_path = Path(__file__).resolve().parents[2] / "server" / "db" / "schema_sqlite.sql"
    if not schema_path.exists():
        return
    sql = schema_path.read_text(encoding="utf-8")
    with engine.begin() as conn:
        for stmt in _split_sql_statements(sql):
            if stmt.strip():
                conn.execute(text(stmt))


def _split_sql_statements(sql: str) -> list[str]:
    statements = []
    current = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            statements.append("\n".join(current))
            current = []
    if current:
        statements.append("\n".join(current))
    return statements
