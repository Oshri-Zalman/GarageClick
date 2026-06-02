"""Notification Service — MOCK WhatsApp integration (TDD §4.7).

In production this module would call the WhatsApp Business API (Twilio/Meta).
Here it only logs the message and records it in memory, so the rest of the
system can depend on a stable interface and the tests can assert what was sent.
"""
import logging
import uuid

logger = logging.getLogger("garageclick.notifications")

# In-memory outbox — stands in for the external provider. Tests inspect/reset it.
_sent: list[dict] = []


def send_whatsapp(phone: str, message: str, ticket_number: str | None = None) -> dict:
    """Pretend to send a WhatsApp message. Returns a provider-like result."""
    message_id = f"mock-{uuid.uuid4().hex[:12]}"
    record = {
        "success": True,
        "message_id": message_id,
        "phone": phone,
        "ticket_number": ticket_number,
        "message": message,
    }
    _sent.append(record)
    logger.info(
        "[WhatsApp MOCK] to=%s ticket=%s id=%s :: %s",
        phone, ticket_number, message_id, message,
    )
    return record


def notify_ticket_completed(ticket: dict) -> dict:
    """Build + send the 'your car is ready' message for a completed ticket."""
    phone = ticket.get("customer_phone")
    ticket_number = ticket.get("ticket_number")
    message = (
        "הטיפול ברכבך הסתיים! ניתן להגיע לאיסוף. "
        f"מספר כרטיס עבודה: {ticket_number}"
    )
    return send_whatsapp(phone, message, ticket_number)


# --- helpers for tests / introspection ---
def sent_messages() -> list[dict]:
    return list(_sent)


def reset() -> None:
    _sent.clear()
