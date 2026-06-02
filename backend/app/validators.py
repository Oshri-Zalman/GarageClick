"""Reusable input validators (used by the Pydantic schemas).

Each function returns the cleaned value or raises ValueError, which FastAPI
surfaces as a 422 with a clear message. Kept locale-light on purpose: these
catch obviously-bad input (wrong length, illegal characters, impossible years)
without over-constraining real-world formatting.
"""
import re
from datetime import datetime, timezone

# Phone: optional leading +, then 9–15 digits once separators are stripped.
_PHONE_SEPARATORS = re.compile(r"[\s\-().]")
_PHONE_RE = re.compile(r"^\+?\d{9,15}$")

# License plate: 4–10 alphanumerics, optionally grouped by single dashes.
_PLATE_RE = re.compile(r"^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$")

_MIN_YEAR = 1900


def _max_year() -> int:
    # Allow next year's models.
    return datetime.now(timezone.utc).year + 1


def clean_phone(value: str) -> str:
    """Normalize a phone number (strip separators) and validate its shape."""
    if value is None:
        raise ValueError("phone_number is required.")
    stripped = _PHONE_SEPARATORS.sub("", value).strip()
    if not _PHONE_RE.match(stripped):
        raise ValueError(
            "phone_number must be 9–15 digits (an optional leading + is allowed)."
        )
    return stripped


def clean_license_plate(value: str) -> str:
    """Validate a license plate: 4–10 alphanumerics, optional single dashes."""
    if value is None:
        raise ValueError("license_plate is required.")
    plate = value.strip().upper()
    alnum = plate.replace("-", "")
    if not (4 <= len(alnum) <= 10) or not _PLATE_RE.match(plate):
        raise ValueError(
            "license_plate must be 4–10 letters/digits, optionally separated by dashes."
        )
    return plate


def validate_year(value: int) -> int:
    """Ensure a vehicle/part year is plausible."""
    if value is None:
        return value
    if not (_MIN_YEAR <= value <= _max_year()):
        raise ValueError(f"year must be between {_MIN_YEAR} and {_max_year()}.")
    return value
