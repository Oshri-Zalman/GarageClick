"""SQLAlchemy ORM models — the 7 GarageClick tables."""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

USER_ROLES = ("Manager", "Secretary", "Mechanic")
TICKET_STATUSES = ("Pending", "In Progress", "Completed")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(Enum(*USER_ROLES, name="user_role"), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(100), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("1"))
    last_login: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    vehicles: Mapped[list["Vehicle"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    license_plate: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    manufacturer: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    customer: Mapped["Customer"] = relationship(back_populates="vehicles")


class TicketWork(Base):
    __tablename__ = "tickets_work"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_mechanic_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Enum(*TICKET_STATUSES, name="ticket_status"),
        nullable=False,
        default="Pending",
        server_default="Pending",
        index=True,
    )
    estimated_completion_time: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    # Set when a completed ticket is closed/archived — kept in the DB & history,
    # but removed from the active Kanban board.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)


class PartInventory(Base):
    __tablename__ = "parts_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    part_name: Mapped[str] = mapped_column(String(255), nullable=False)
    part_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    manufacturer: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    year_start: Mapped[int | None] = mapped_column(Integer)
    quantity_current: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class TicketPartUsed(Base):
    __tablename__ = "ticket_parts_used"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets_work.id", ondelete="CASCADE"), nullable=False
    )
    part_id: Mapped[int] = mapped_column(ForeignKey("parts_inventory.id"), nullable=False)
    quantity_used: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class VehicleModel(Base):
    """Reference catalog of vehicle manufacturers and their models — the source
    of truth for the frontend's cascading make/model dropdowns. Each row links a
    model to its manufacturer."""
    __tablename__ = "vehicle_models"
    __table_args__ = (UniqueConstraint("manufacturer", "model", name="uq_vehicle_model"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    manufacturer: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str | None] = mapped_column(String(100))
    resource_type: Mapped[str | None] = mapped_column(String(50))
    resource_id: Mapped[int | None] = mapped_column(Integer)
    old_value: Mapped[str | None] = mapped_column(String(500))
    new_value: Mapped[str | None] = mapped_column(String(500))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )
