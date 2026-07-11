#!/usr/bin/env python3
"""CLI entry for manual scrape jobs."""

import sys

from server.db.connection import SessionLocal, init_sqlite_schema
from server.db.models import Base, ScrapeJob, new_id
from server.db.connection import engine
from server.db.seed import seed_defaults
from server.services.scrape_runner import run_scrape_job


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "https://icook.tw/recipes/391516"
    Base.metadata.create_all(bind=engine)
    init_sqlite_schema()
    db = SessionLocal()
    seed_defaults(db)
    job = ScrapeJob(id=new_id(), url=url, status="pending", triggered_by="cli")
    db.add(job)
    db.commit()
    print(f"Job {job.id} running...")
    run_scrape_job(job.id)
    db.refresh(job)
    print(f"Done: {job.status}, results={job.result_count}, error={job.error_message}")
    db.close()


if __name__ == "__main__":
    main()
