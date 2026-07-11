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

    templates = [
        {
            "name": "iCook 食譜",
            "domain": "icook.tw",
            "base_url": "https://icook.tw/recipes/",
            "config": {"type": "icook_recipe", "data_line": "street_food"},
        },
        {
            "name": "Subway 台灣營養",
            "domain": "subway.com",
            "base_url": "https://www.subway.com/zh-TW/menunutrition",
            "config": {
                "type": "subway_nutrition",
                "brand": "Subway",
                "data_line": "convenience_chain",
            },
        },
    ]

    for tpl in templates:
        exists = (
            db.query(ScraperTemplate)
            .filter(ScraperTemplate.name == tpl["name"])
            .first()
        )
        if not exists:
            db.add(
                ScraperTemplate(
                    id=new_id(),
                    name=tpl["name"],
                    domain=tpl["domain"],
                    base_url=tpl["base_url"],
                    config=json.dumps(tpl["config"], ensure_ascii=False),
                )
            )

    db.commit()
