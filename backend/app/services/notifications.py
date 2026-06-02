"""Notification Service — WhatsApp (mock or real Twilio).

Provider is chosen by settings.NOTIFICATIONS_PROVIDER:
  - "mock"   : log only + record in memory (default; used by tests/dev).
  - "twilio" : send a real WhatsApp message via the Twilio API.

Either way the message is recorded in an in-memory outbox so the rest of the
system has a stable interface and tests can assert what would be sent.
"""
import logging
import re
import uuid

from ..config import settings

logger = logging.getLogger("garageclick.notifications")

# In-memory outbox (the mock "provider" + a record of real sends).
_sent: list[dict] = []

_NON_DIGITS = re.compile(r"[^\d+]")


def to_e164(phone: str, default_country: str = "972") -> str:
    """Best-effort conversion of a local phone to E.164 (e.g. 0501234567 ->
    +972501234567). Israeli-focused but safe for already-international numbers."""
    if not phone:
        return phone
    p = _NON_DIGITS.sub("", phone.strip())
    if p.startswith("+"):
        return p
    if p.startswith("00"):
        return "+" + p[2:]
    if p.startswith("0"):
        return f"+{default_country}{p[1:]}"
    if p.startswith(default_country):
        return "+" + p
    return "+" + p


def _send_mock(to: str, message: str, ticket_number: str | None) -> dict:
    record = {
        "success": True,
        "provider": "mock",
        "message_id": f"mock-{uuid.uuid4().hex[:12]}",
        "phone": to,
        "ticket_number": ticket_number,
        "message": message,
    }
    logger.info("[WhatsApp MOCK] to=%s ticket=%s :: %s", to, ticket_number, message)
    return record


def _send_twilio(to: str, message: str, ticket_number: str | None) -> dict:
    record = {
        "success": False,
        "provider": "twilio",
        "message_id": None,
        "phone": to,
        "ticket_number": ticket_number,
        "message": message,
    }
    try:
        from twilio.rest import Client  # imported lazily so tests need no twilio

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            from_=f"whatsapp:{settings.TWILIO_WHATSAPP_FROM}",
            to=f"whatsapp:{to}",
            body=message,
        )
        record["success"] = True
        record["message_id"] = msg.sid
        logger.info("[WhatsApp Twilio] sent to=%s sid=%s", to, msg.sid)
    except Exception as exc:  # never raise to the caller
        record["error"] = str(exc)
        logger.exception("[WhatsApp Twilio] send failed to=%s", to)
    return record


def send_whatsapp(phone: str, message: str, ticket_number: str | None = None) -> dict:
    """Send (or mock) a WhatsApp message. Returns a provider-like result and
    records it in the outbox. Never raises."""
    to = to_e164(phone)
    if settings.NOTIFICATIONS_PROVIDER == "twilio":
        record = _send_twilio(to, message, ticket_number)
    else:
        record = _send_mock(to, message, ticket_number)
    _sent.append(record)
    return record


def notify_ticket_completed(ticket: dict) -> dict:
    """Build + send the 'your car is ready' message for a completed ticket."""
    message = (
        "הטיפול ברכבך הסתיים! ניתן להגיע לאיסוף. "
        f"מספר כרטיס עבודה: {ticket.get('ticket_number')}"
    )
    return send_whatsapp(ticket.get("customer_phone"), message, ticket.get("ticket_number"))


# --- helpers for tests / introspection ---
def sent_messages() -> list[dict]:
    return list(_sent)


def reset() -> None:
    _sent.clear()
