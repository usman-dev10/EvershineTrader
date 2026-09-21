from app.core.config import get_settings
from app.core.exceptions import AppError

DEMO_USERS = [
    {
        "phone": "03001234567",
        "password": "company123",
        "role": "company",
        "display_name": "Evershine Company",
    },
    {
        "phone": "03007654321",
        "password": "employee123",
        "role": "employee",
        "display_name": "Floor Operator",
    },
]


def assert_demo_enabled() -> None:
    if not get_settings().demo_auth_enabled:
        raise AppError(
            "DEMO_DISABLED",
            "Demo authentication is disabled.",
            status_code=403,
        )


def match_demo_user(phone: str, password: str) -> dict | None:
    assert_demo_enabled()
    normalized = phone.strip()
    for user in DEMO_USERS:
        if user["phone"] == normalized and user["password"] == password:
            return user
    return None
