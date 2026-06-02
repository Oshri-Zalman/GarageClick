"""Comprehensive input-validation tests (unit + endpoint level)."""
import pytest

from app.validators import clean_license_plate, clean_phone, validate_year

from .helpers import auth, create_customer, create_user, token_for


# --------------------------------------------------------------------------
# Unit tests for the validators themselves
# --------------------------------------------------------------------------
class TestPhoneValidator:
    def test_accepts_plain(self):
        assert clean_phone("0501234567") == "0501234567"

    def test_strips_separators(self):
        assert clean_phone("050-123-4567") == "0501234567"
        assert clean_phone("(050) 123 4567") == "0501234567"

    def test_accepts_international(self):
        assert clean_phone("+972501234567") == "+972501234567"

    @pytest.mark.parametrize("bad", ["12345", "050abc1234", "", "phone", "12"])
    def test_rejects_bad(self, bad):
        with pytest.raises(ValueError):
            clean_phone(bad)


class TestPlateValidator:
    def test_uppercases(self):
        assert clean_license_plate("ab-123") == "AB-123"

    def test_accepts_dashed_digits(self):
        assert clean_license_plate("123-456") == "123-456"

    @pytest.mark.parametrize("bad", ["abc", "12", "1234567890123", "12 34", "12@34", ""])
    def test_rejects_bad(self, bad):
        with pytest.raises(ValueError):
            clean_license_plate(bad)


class TestYearValidator:
    def test_accepts_reasonable(self):
        assert validate_year(2018) == 2018

    def test_allows_none(self):
        assert validate_year(None) is None

    @pytest.mark.parametrize("bad", [1800, 3000, 0, -5])
    def test_rejects_bad(self, bad):
        with pytest.raises(ValueError):
            validate_year(bad)


# --------------------------------------------------------------------------
# Endpoint-level tests: invalid bodies must return 422 (with a valid token,
# so we isolate the validation failure rather than auth).
# --------------------------------------------------------------------------
def staff_token():
    return token_for(create_user(username="mgr", role="Manager"))


class TestCustomerValidation:
    def test_bad_phone_422(self, client):
        res = client.post("/api/customers", headers=auth(staff_token()),
                          json={"full_name": "דן", "phone_number": "12"})
        assert res.status_code == 422

    def test_phone_normalized_on_create(self, client):
        res = client.post("/api/customers", headers=auth(staff_token()),
                          json={"full_name": "דן", "phone_number": "050-123-4567"})
        assert res.status_code == 201
        assert res.json()["phone_number"] == "0501234567"

    def test_overlong_name_422(self, client):
        res = client.post("/api/customers", headers=auth(staff_token()),
                          json={"full_name": "x" * 256, "phone_number": "0501234567"})
        assert res.status_code == 422


class TestVehicleValidation:
    def test_bad_plate_422(self, client):
        customer = create_customer()
        res = client.post("/api/vehicles", headers=auth(staff_token()), json={
            "customer_id": customer["id"], "license_plate": "12@34",
            "manufacturer": "VW", "model": "Golf", "year": 2018})
        assert res.status_code == 422

    def test_bad_year_422(self, client):
        customer = create_customer()
        res = client.post("/api/vehicles", headers=auth(staff_token()), json={
            "customer_id": customer["id"], "license_plate": "123-456",
            "manufacturer": "VW", "model": "Golf", "year": 1700})
        assert res.status_code == 422

    def test_plate_uppercased_on_create(self, client):
        customer = create_customer()
        res = client.post("/api/vehicles", headers=auth(staff_token()), json={
            "customer_id": customer["id"], "license_plate": "ab-123",
            "manufacturer": "VW", "model": "Golf", "year": 2018})
        assert res.status_code == 201
        assert res.json()["license_plate"] == "AB-123"


class TestPartValidation:
    def test_negative_quantity_422(self, client):
        res = client.post("/api/parts", headers=auth(staff_token()), json={
            "part_name": "Brakes", "part_code": "BRK", "quantity_current": -3})
        assert res.status_code == 422

    def test_bad_year_start_422(self, client):
        res = client.post("/api/parts", headers=auth(staff_token()), json={
            "part_name": "Brakes", "part_code": "BRK", "year_start": 3000})
        assert res.status_code == 422


class TestTicketValidation:
    def _ctx(self):
        manager = create_user(username="mgr2", role="Manager")
        mechanic = create_user(username="mech", role="Mechanic")
        customer = create_customer()
        from .helpers import create_vehicle
        vehicle = create_vehicle(customer_id=customer["id"], license_plate="123-456")
        return token_for(manager), mechanic, vehicle

    def test_overlong_description_422(self, client):
        token, mechanic, vehicle = self._ctx()
        res = client.post("/api/tickets", headers=auth(token), json={
            "vehicle_id": vehicle["id"], "assigned_mechanic_id": mechanic["id"],
            "description": "x" * 1001})
        assert res.status_code == 422

    def test_invalid_status_value_422(self, client):
        token, mechanic, vehicle = self._ctx()
        created = client.post("/api/tickets", headers=auth(token), json={
            "vehicle_id": vehicle["id"], "assigned_mechanic_id": mechanic["id"],
            "description": "test"})
        tid = created.json()["id"]
        res = client.patch(f"/api/tickets/{tid}/status", headers=auth(token),
                           json={"new_status": "Banana"})
        assert res.status_code == 422

    def test_bad_new_customer_phone_422(self, client):
        token, mechanic, _ = self._ctx()
        res = client.post("/api/tickets", headers=auth(token), json={
            "license_plate": "555-555",
            "new_customer": {"full_name": "דוד", "phone_number": "bad"},
            "new_vehicle": {"manufacturer": "BMW", "model": "320i", "year": 2020},
            "assigned_mechanic_id": mechanic["id"], "description": "oil"})
        assert res.status_code == 422
