import json
import os

import bcrypt
from sqlalchemy.orm import Session

from server.db.models import ScraperTemplate, User, new_id


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def seed_defaults(db: Session) -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "admin@eat-ai.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "changeme")

    if not db.query(User).filter(User.email == admin_email).first():
        db.add(
            User(
                id=new_id(),
                email=admin_email,
                password_hash=hash_password(admin_password),
                role="admin",
                display_name="Admin",
            )
        )

    desired = [
        {
            "name": "iCook 熱門食譜（示範）",
            "domain": "icook.tw",
            "base_url": "https://icook.tw/recipes/",
            "config": {"type": "icook_seed_batch", "data_line": "street_food"},
        },
        {
            "name": "Subway 台灣營養目錄",
            "domain": "subway.com",
            "base_url": "catalog://subway_tw.json",
            "config": {
                "type": "subway_catalog",
                "brand": "Subway",
                "data_line": "convenience_chain",
            },
        },
        {
            "name": "麥當勞台灣營養目錄",
            "domain": "mcdonalds.com.tw",
            "base_url": "catalog://mcdonalds_tw.json",
            "config": {
                "type": "mcdonalds_catalog",
                "brand": "McDonald's",
                "data_line": "convenience_chain",
            },
        },
    ]

    existing = {t.name: t for t in db.query(ScraperTemplate).all()}
    for tpl in desired:
        if tpl["name"] in existing:
            row = existing[tpl["name"]]
            row.domain = tpl["domain"]
            row.base_url = tpl["base_url"]
            row.config = json.dumps(tpl["config"], ensure_ascii=False)
            row.is_active = True
        else:
            db.add(
                ScraperTemplate(
                    id=new_id(),
                    name=tpl["name"],
                    domain=tpl["domain"],
                    base_url=tpl["base_url"],
                    config=json.dumps(tpl["config"], ensure_ascii=False),
                )
            )

    # deactivate obsolete templates
    for name, row in existing.items():
        if name not in {t["name"] for t in desired}:
            row.is_active = False

    db.commit()
