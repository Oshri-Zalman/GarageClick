"""FastAPI dependencies for authentication and role-based authorization.

These are the Python equivalents of the Node `authenticate` and
`authorize(roles)` middleware.
"""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .security import decode_token, is_revoked

# auto_error=False so we can return our own 401 message instead of FastAPI's.
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Verify the Bearer JWT; return {"user_id", "role"}. 401 on failure.

    Stateless — does not touch the DB (TDD §8.1).
    """
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
        )
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    jti = payload.get("jti")
    if is_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked (logged out).",
        )

    return {"user_id": payload.get("user_id"), "role": payload.get("role"), "jti": jti}


def require_roles(*allowed_roles: str):
    """Dependency factory restricting a route to the given roles (403 otherwise)."""

    def _dependency(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: insufficient role.",
            )
        return user

    return _dependency


# Convenience role sets.
ALL_ROLES = ("Manager", "Secretary", "Mechanic")
STAFF = ("Manager", "Secretary")
