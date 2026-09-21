"""Password hashing — bcrypt with legacy SHA-256 verify for existing rows."""
from hashlib import sha256

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode(
        "utf-8"
    )


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    raw = password.encode("utf-8")
    stored = password_hash.encode("utf-8")
    try:
        if password_hash.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(raw, stored)
        # Legacy SHA-256 hex (pre-deploy hashes)
        if len(password_hash) == 64 and all(
            c in "0123456789abcdef" for c in password_hash.lower()
        ):
            return sha256(raw).hexdigest() == password_hash.lower()
    except (ValueError, TypeError):
        return False
    return False
