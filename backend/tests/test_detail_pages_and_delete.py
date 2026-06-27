"""
Iteration 8 backend tests focused on:
- NEW: GET /api/agencies/{id} (admin only)
- Re-verify GET /api/clients/{id} exists (already used by ClientDetailPage)
- Full delete flow (DELETE then GET -> 404) for both client and agency
- Role guards: agence cannot DELETE/PUT/GET agency (403)
"""
import os
import time
import uuid
import requests
import pytest

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@cargolink.ma", "admin123")


@pytest.fixture(scope="module")
def agence():
    return _login("agence.casa@cargolink.ma", "agence123")


def _new_client_via_agence(agence_sess):
    """Create a throwaway client by creating a shipment with a new_client payload."""
    email = f"TEST_client_{uuid.uuid4().hex[:8]}@example.com".lower()
    payload = {
        "recipient": {"first_name": "R", "last_name": "X", "address": "1 rue", "country": "FR", "phone": "+33100"},
        "parcel": {"type": "small", "weight": 1.0, "length": 10, "width": 10, "height": 10,
                   "declared_value": 50, "category": "autre"},
        "origin_country": "MA",
        "pickup_mode": "agency",
        "new_client": {"first_name": "Test", "last_name": "Client",
                       "email": email, "phone": "+212600", "address": "Casablanca"},
        "create_account": False,
    }
    r = agence_sess.post(f"{API}/shipments", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    s = r.json()
    return s["client_id"], email


# ---- Agency GET-by-id (new) + full delete flow ----
class TestAgencyDetailAndDelete:
    def test_admin_can_get_agency_by_id_and_delete_flow(self, admin):
        # Create
        email = f"TEST_agency_{uuid.uuid4().hex[:8]}@cargolink.ma".lower()
        r = admin.post(f"{API}/agencies", json={
            "agency_name": "TEST Agence", "email": email,
            "phone": "+212611", "address": "Rabat",
        }, timeout=15)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]

        # GET by id - new endpoint
        g = admin.get(f"{API}/agencies/{aid}", timeout=15)
        assert g.status_code == 200, g.text
        body = g.json()
        assert body["id"] == aid
        assert body["email"] == email
        assert body["agency_name"] == "TEST Agence"
        assert "created_count" in body
        assert isinstance(body["created_count"], int)

        # DELETE
        d = admin.delete(f"{API}/agencies/{aid}", timeout=15)
        assert d.status_code == 200
        assert d.json().get("ok") is True

        # GET after DELETE -> 404
        g2 = admin.get(f"{API}/agencies/{aid}", timeout=15)
        assert g2.status_code == 404

    def test_agence_role_forbidden_on_agency_endpoints(self, admin, agence):
        # admin creates an agency
        email = f"TEST_agency_{uuid.uuid4().hex[:8]}@cargolink.ma"
        r = admin.post(f"{API}/agencies", json={
            "agency_name": "TEST Agence FB", "email": email,
            "phone": "+212611", "address": "Rabat",
        }, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]

        try:
            # GET by id with agence -> 403
            g = agence.get(f"{API}/agencies/{aid}", timeout=15)
            assert g.status_code == 403, g.text

            # PUT with agence -> 403
            p = agence.put(f"{API}/agencies/{aid}", json={
                "agency_name": "X", "email": email, "phone": "+212611", "address": "X",
            }, timeout=15)
            assert p.status_code == 403

            # DELETE with agence -> 403
            d = agence.delete(f"{API}/agencies/{aid}", timeout=15)
            assert d.status_code == 403
        finally:
            admin.delete(f"{API}/agencies/{aid}", timeout=15)


# ---- Client detail + full delete flow (used by ClientDetailPage) ----
class TestClientDetailAndDelete:
    def test_client_detail_and_delete_flow(self, agence):
        cid, email = _new_client_via_agence(agence)

        # GET /clients/{id} returns client+shipments
        g = agence.get(f"{API}/clients/{cid}", timeout=15)
        assert g.status_code == 200, g.text
        body = g.json()
        assert "client" in body and "shipments" in body
        assert body["client"]["id"] == cid
        assert body["client"]["email"] == email
        assert isinstance(body["shipments"], list)
        assert len(body["shipments"]) >= 1  # created at least one shipment

        # DELETE client
        d = agence.delete(f"{API}/clients/{cid}", timeout=15)
        assert d.status_code == 200
        assert d.json().get("ok") is True

        # GET after DELETE -> 404
        g2 = agence.get(f"{API}/clients/{cid}", timeout=15)
        assert g2.status_code == 404

    def test_admin_can_also_delete_client(self, admin, agence):
        cid, _ = _new_client_via_agence(agence)
        d = admin.delete(f"{API}/clients/{cid}", timeout=15)
        assert d.status_code == 200
        g2 = admin.get(f"{API}/clients/{cid}", timeout=15)
        assert g2.status_code == 404
