"""Password hashing (bcrypt) and JWT helpers."""
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings

# In-memory revoked-token store (by jti). Good enough for the MVP; a production
# deployment would back this with Redis so it survives restarts and scales.
_revoked_jti: set[str] = set()


def revoke(jti: str) -> None:
    if jti:
        _revoked_jti.add(jti)


def is_revoked(jti: str) -> bool:
    return jti in _revoked_jti


def clear_revoked() -> None:
    _revoked_jti.clear()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user_id: int, role: str) -> str:
    """Sign a JWT carrying the user's id and role (TDD §4.1). The jti lets a
    token be revoked at logout."""
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRES_HOURS)
    payload = {"user_id": user_id, "role": role, "exp": expire, "jti": uuid.uuid4().hex}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Raise jwt.PyJWTError if invalid/expired."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
