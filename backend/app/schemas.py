"""Pydantic request schemas with input validation.

Field-level violations (length, format, missing) yield a 422 with a clear
message; business-rule failures are raised as HTTPExceptions in the routers
(400/403/404/409).
"""
from pydantic import BaseModel, Field, field_validator

from .validators import clean_license_plate, clean_phone, validate_year


# ----- Auth -----
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=255)


# ----- Customers -----
class CustomerCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=1, max_length=20)

    @field_validator("phone_number")
    @classmethod
    def _phone(cls, v: str) -> str:
        return clean_phone(v)


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone_number: str | None = Field(default=None, max_length=20)

    @field_validator("phone_number")
    @classmethod
    def _phone(cls, v):
        return clean_phone(v) if v is not None else v


# ----- Vehicles -----
class VehicleCreate(BaseModel):
    customer_id: int = Field(gt=0)
    license_plate: str = Field(min_length=1, max_length=20)
    manufacturer: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int | None = None

    @field_validator("license_plate")
    @classmethod
    def _plate(cls, v: str) -> str:
        return clean_license_plate(v)

    @field_validator("year")
    @classmethod
    def _year(cls, v):
        return validate_year(v)


class VehicleUpdate(BaseModel):
    license_plate: str | None = Field(default=None, max_length=20)
    manufacturer: str | None = Field(default=None, min_length=1, max_length=100)
    model: str | None = Field(default=None, min_length=1, max_length=100)
    year: int | None = None

    @field_validator("license_plate")
    @classmethod
    def _plate(cls, v):
        return clean_license_plate(v) if v is not None else v

    @field_validator("year")
    @classmethod
    def _year(cls, v):
        return validate_year(v)


# ----- Parts -----
class PartCreate(BaseModel):
    part_name: str = Field(min_length=1, max_length=255)
    part_code: str = Field(min_length=1, max_length=50)
    manufacturer: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    year_start: int | None = None
    quantity_current: int = Field(default=0, ge=0)

    @field_validator("year_start")
    @classmethod
    def _year(cls, v):
        return validate_year(v)


class PartUpdate(BaseModel):
    part_name: str | None = Field(default=None, min_length=1, max_length=255)
    part_code: str | None = Field(default=None, min_length=1, max_length=50)
    manufacturer: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    year_start: int | None = None
    quantity_current: int | None = Field(default=None, ge=0)

    @field_validator("year_start")
    @classmethod
    def _year(cls, v):
        return validate_year(v)


# ----- Tickets -----
class NewCustomer(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=1, max_length=20)

    @field_validator("phone_number")
    @classmethod
    def _phone(cls, v: str) -> str:
        return clean_phone(v)


class NewVehicle(BaseModel):
    manufacturer: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int | None = None

    @field_validator("year")
    @classmethod
    def _year(cls, v):
        return validate_year(v)


class PartLine(BaseModel):
    part_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1)


class TicketCreate(BaseModel):
    assigned_mechanic_id: int = Field(gt=0)
    description: str = Field(min_length=1, max_length=1000)
    estimated_completion_time: str | None = None
    # Scenario A:
    vehicle_id: int | None = Field(default=None, gt=0)
    # Scenario B:
    license_plate: str | None = Field(default=None, max_length=20)
    new_customer: NewCustomer | None = None
    new_vehicle: NewVehicle | None = None
    # Optional parts (the "other"/no-parts case is an empty list or omitted).
    parts: list[PartLine] = Field(default_factory=list)

    @field_validator("license_plate")
    @classmethod
    def _plate(cls, v):
        return clean_license_plate(v) if v is not None else v


class StatusUpdate(BaseModel):
    new_status: str = Field(min_length=1)
    confirmation: bool = False

    @field_validator("new_status")
    @classmethod
    def _status(cls, v: str) -> str:
        allowed = {"Pending", "In Progress", "Completed"}
        if v not in allowed:
            raise ValueError(f"new_status must be one of {sorted(allowed)}.")
        return v
