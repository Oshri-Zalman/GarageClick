"""Test factories + auth helpers (direct DB inserts bypass the API)."""
from app.database import SessionLocal
from app.models import Customer, PartInventory, User, Vehicle
from app.security import create_token, hash_password


def create_user(username, password="secret123", role="Mechanic",
                full_name="Test User", is_active=True):
    with SessionLocal() as db:
        user = User(
            username=username,
            password_hash=hash_password(password),
            role=role,
            full_name=full_name,
            is_active=is_active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"id": user.id, "username": username, "role": role}


def create_customer(full_name="דן", phone_number="0501234567"):
    with SessionLocal() as db:
        c = Customer(full_name=full_name, phone_number=phone_number)
        db.add(c)
        db.commit()
        db.refresh(c)
        return {"id": c.id, "full_name": full_name, "phone_number": phone_number}


def create_vehicle(customer_id, license_plate="123-456",
                   manufacturer="Volkswagen", model="Golf", year=2018):
    with SessionLocal() as db:
        v = Vehicle(
            customer_id=customer_id,
            license_plate=license_plate,
            manufacturer=manufacturer,
            model=model,
            year=year,
        )
        db.add(v)
        db.commit()
        db.refresh(v)
        return {"id": v.id, "customer_id": customer_id, "license_plate": license_plate,
                "manufacturer": manufacturer, "model": model, "year": year}


def create_part(part_name="Front brake disc", part_code="BRK-001",
                manufacturer="Volkswagen", model="Golf", year_start=2015,
                quantity_current=10):
    with SessionLocal() as db:
        p = PartInventory(
            part_name=part_name,
            part_code=part_code,
            manufacturer=manufacturer,
            model=model,
            year_start=year_start,
            quantity_current=quantity_current,
        )
        db.add(p)
        db.commit()
        db.refresh(p)
        return {"id": p.id, "part_name": part_name, "part_code": part_code,
                "quantity_current": quantity_current}


def part_quantity(part_id):
    with SessionLocal() as db:
        p = db.get(PartInventory, part_id)
        return p.quantity_current if p else None


def count(table_model):
    with SessionLocal() as db:
        return db.query(table_model).count()


def token_for(user):
    return create_token(user["id"], user["role"])


def auth(token):
    return {"Authorization": f"Bearer {token}"}
