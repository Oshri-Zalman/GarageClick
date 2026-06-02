"""Pydantic request schemas. Missing/invalid fields here yield a 422 (FastAPI
convention); business-rule failures are raised as explicit HTTPExceptions in
the routers (400/403/404/409)."""
from pydantic import BaseModel, Field


# ----- Auth -----
class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


# ----- Customers -----
class CustomerCreate(BaseModel):
    full_name: str = Field(min_length=1)
    phone_number: str = Field(min_length=1)


class CustomerUpdate(BaseModel):
    full_name: str | None = None
    phone_number: str | None = None


# ----- Vehicles -----
class VehicleCreate(BaseModel):
    customer_id: int
    license_plate: str = Field(min_length=1)
    manufacturer: str = Field(min_length=1)
    model: str = Field(min_length=1)
    year: int | None = None


class VehicleUpdate(BaseModel):
    license_plate: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    year: int | None = None


# ----- Parts -----
class PartCreate(BaseModel):
    part_name: str = Field(min_length=1)
    part_code: str = Field(min_length=1)
    manufacturer: str | None = None
    model: str | None = None
    year_start: int | None = None
    quantity_current: int = 0


class PartUpdate(BaseModel):
    part_name: str | None = None
    part_code: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    year_start: int | None = None
    quantity_current: int | None = None


# ----- Tickets -----
class NewCustomer(BaseModel):
    full_name: str = Field(min_length=1)
    phone_number: str = Field(min_length=1)


class NewVehicle(BaseModel):
    manufacturer: str = Field(min_length=1)
    model: str = Field(min_length=1)
    year: int | None = None


class PartLine(BaseModel):
    part_id: int
    quantity: int = Field(default=1, ge=1)


class TicketCreate(BaseModel):
    assigned_mechanic_id: int
    description: str = Field(min_length=1)
    estimated_completion_time: str | None = None
    # Scenario A:
    vehicle_id: int | None = None
    # Scenario B:
    license_plate: str | None = None
    new_customer: NewCustomer | None = None
    new_vehicle: NewVehicle | None = None
    # Optional parts (the "other"/no-parts case is an empty list or omitted).
    parts: list[PartLine] = Field(default_factory=list)


class StatusUpdate(BaseModel):
    new_status: str
    confirmation: bool = False
