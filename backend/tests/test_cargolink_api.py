"""End-to-end backend API tests for CargoLink (Europe<->Morocco logistics)."""
import os
import time
import random
import string
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-eu-ma.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@cargolink.ma", "password": "admin123"}
AGENT = {"email": "agent@cargolink.ma", "password": "agent123"}


def rand_suffix(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def client_user():
    """Register a fresh client user for testing."""
    s = requests.Session()
    suffix = rand_suffix()
    payload = {
        "first_name": "Test",
        "last_name": "Client",
        "email": f"TEST_client_{suffix}@test.com",
        "phone": "+33600000000",
        "address": "10 rue de Paris",
        "password": "client123",
    }
    r = s.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"].lower() == payload["email"].lower()
    assert data["role"] == "client"
    return {"session": s, "user": data, "password": payload["password"]}


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="session")
def agent_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=AGENT, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Agent login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="session")
def shipment(client_user):
    """Create one shipment for the test client."""
    s = client_user["session"]
    payload = {
        "recipient": {
            "first_name": "Fatima",
            "last_name": "El Amrani",
            "address": "Rue Mohamed V, Casablanca",
            "country": "MA",
            "phone": "+212600000001",
        },
        "parcel": {"type": "box", "weight": 5.0, "declared_value": 100.0, "category": "habillement"},
        "origin_country": "FR",
        "pickup_mode": "agency",
    }
    r = s.post(f"{API}/shipments", json=payload, timeout=15)
    assert r.status_code == 200, f"create shipment failed: {r.text}"
    data = r.json()
    assert data["tracking_number"].startswith("CL")
    assert data["qr_code"].startswith("data:image/png;base64,")
    assert data["status"] == "demande_creee"
    return data


# ---------------- Auth ----------------
class TestAuth:
    def test_register_returns_user_and_sets_cookie(self):
        s = requests.Session()
        payload = {
            "first_name": "Reg", "last_name": "User",
            "email": f"TEST_reg_{rand_suffix()}@test.com",
            "phone": "+33611111111", "address": "Paris",
            "password": "pw12345",
        }
        r = s.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == payload["email"].lower()
        assert "password_hash" not in body
        assert "_id" not in body
        assert "id" in body
        # cookie set
        assert "access_token" in s.cookies.get_dict()
        # /me works
        me = s.get(f"{API}/auth/me", timeout=10)
        assert me.status_code == 200
        assert me.json()["email"] == payload["email"].lower()

    def test_register_duplicate_email(self, client_user):
        s = requests.Session()
        payload = {
            "first_name": "x", "last_name": "y",
            "email": client_user["user"]["email"],
            "phone": "+33611", "address": "x", "password": "abc12345",
        }
        r = s.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code == 400

    def test_login_admin(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_agent(self, agent_session):
        r = agent_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "agent"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ---------------- Estimate (public) ----------------
class TestEstimate:
    def test_estimate_public(self):
        r = requests.post(f"{API}/estimate", json={
            "weight": 5.0, "origin_country": "FR", "destination_country": "MA",
            "category": "habillement", "declared_value": 200.0,
        }, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("shipping_eur", "shipping_mad", "customs_low_eur", "customs_high_eur",
                  "total_low_eur", "total_high_eur", "eur_to_mad"):
            assert k in d
        assert d["shipping_eur"] > 0
        assert d["shipping_mad"] > d["shipping_eur"]  # MAD > EUR


# ---------------- Shipments ----------------
class TestShipments:
    def test_create_shipment(self, shipment):
        assert shipment["tracking_number"].startswith("CL")
        assert "estimate" in shipment and shipment["estimate"]["shipping_eur"] > 0
        assert len(shipment["history"]) == 1

    def test_list_shipments_client_isolation(self, client_user, shipment):
        r = client_user["session"].get(f"{API}/shipments", timeout=10)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert shipment["id"] in ids
        # all belong to this client
        for s in r.json():
            assert s["client_id"] == client_user["user"]["id"]

    def test_list_shipments_admin_sees_all(self, admin_session, shipment):
        r = admin_session.get(f"{API}/shipments", timeout=10)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert shipment["id"] in ids

    def test_track_public(self, shipment):
        r = requests.get(f"{API}/shipments/track/{shipment['tracking_number']}", timeout=10)
        assert r.status_code == 200
        assert r.json()["tracking_number"] == shipment["tracking_number"]

    def test_track_invalid(self):
        r = requests.get(f"{API}/shipments/track/CL0000000000", timeout=10)
        assert r.status_code == 404

    def test_get_shipment_owner(self, client_user, shipment):
        r = client_user["session"].get(f"{API}/shipments/{shipment['id']}", timeout=10)
        assert r.status_code == 200

    def test_get_shipment_other_client_forbidden(self, shipment):
        # register another client and try to access
        s = requests.Session()
        payload = {
            "first_name": "Other", "last_name": "Client",
            "email": f"TEST_other_{rand_suffix()}@test.com",
            "phone": "+33622", "address": "Paris", "password": "pw12345",
        }
        s.post(f"{API}/auth/register", json=payload, timeout=10)
        r = s.get(f"{API}/shipments/{shipment['id']}", timeout=10)
        assert r.status_code == 403

    def test_status_update_persists_and_appears_in_track(self, admin_session, shipment):
        r = admin_session.put(
            f"{API}/shipments/{shipment['id']}/status",
            json={"status": "recu_agence", "note": "Reçu à l'agence"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "recu_agence"
        # Public track reflects update
        t = requests.get(f"{API}/shipments/track/{shipment['tracking_number']}", timeout=10)
        assert t.status_code == 200
        assert t.json()["status"] == "recu_agence"

    def test_status_update_invalid(self, admin_session, shipment):
        r = admin_session.put(f"{API}/shipments/{shipment['id']}/status",
                              json={"status": "not_a_status"}, timeout=10)
        assert r.status_code == 400

    def test_client_cannot_update_status(self, client_user, shipment):
        r = client_user["session"].put(f"{API}/shipments/{shipment['id']}/status",
                                       json={"status": "en_transit"}, timeout=10)
        assert r.status_code == 403


# ---------------- e-Ticket PDF ----------------
class TestETicket:
    def test_client_can_download_own_ticket(self, client_user, shipment):
        r = client_user["session"].get(f"{API}/shipments/{shipment['id']}/ticket", timeout=20)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        assert f"eticket-{shipment['tracking_number']}.pdf" in cd
        assert r.content.startswith(b"%PDF"), "Response body is not a PDF"
        assert len(r.content) > 1000  # non-trivial PDF

    def test_admin_can_download_any_ticket(self, admin_session, shipment):
        r = admin_session.get(f"{API}/shipments/{shipment['id']}/ticket", timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")

    def test_agent_can_download_any_ticket(self, agent_session, shipment):
        r = agent_session.get(f"{API}/shipments/{shipment['id']}/ticket", timeout=20)
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")

    def test_other_client_cannot_download_ticket(self, shipment):
        s = requests.Session()
        payload = {
            "first_name": "Other", "last_name": "User",
            "email": f"TEST_other2_{rand_suffix()}@test.com",
            "phone": "+33633", "address": "Lyon", "password": "pw12345",
        }
        reg = s.post(f"{API}/auth/register", json=payload, timeout=15)
        assert reg.status_code == 200
        r = s.get(f"{API}/shipments/{shipment['id']}/ticket", timeout=15)
        assert r.status_code == 403

    def test_ticket_requires_auth(self, shipment):
        r = requests.get(f"{API}/shipments/{shipment['id']}/ticket", timeout=10)
        assert r.status_code == 401


# ---------------- Scanner ----------------
class TestScanner:
    def test_scan_lookup_staff(self, agent_session, shipment):
        r = agent_session.get(f"{API}/scan/{shipment['tracking_number']}", timeout=10)
        assert r.status_code == 200
        assert r.json()["tracking_number"] == shipment["tracking_number"]

    def test_scan_lookup_forbidden_for_client(self, client_user, shipment):
        r = client_user["session"].get(f"{API}/scan/{shipment['tracking_number']}", timeout=10)
        assert r.status_code == 403

    def test_scan_update_status(self, agent_session, shipment):
        r = agent_session.put(
            f"{API}/scan/{shipment['tracking_number']}/status",
            json={"status": "en_transit", "note": "Parti du hub"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "en_transit"
        # verify persistence via public track
        t = requests.get(f"{API}/shipments/track/{shipment['tracking_number']}", timeout=10)
        assert t.json()["status"] == "en_transit"

    def test_scan_lookup_unknown(self, agent_session):
        r = agent_session.get(f"{API}/scan/CL9999999999", timeout=10)
        assert r.status_code == 404


# ---------------- Clients / Dashboard ----------------
class TestClientsDashboard:
    def test_list_clients_staff(self, admin_session, client_user):
        r = admin_session.get(f"{API}/clients", timeout=10)
        assert r.status_code == 200
        emails = [c["email"] for c in r.json()]
        assert client_user["user"]["email"] in emails

    def test_list_clients_forbidden_for_client(self, client_user):
        r = client_user["session"].get(f"{API}/clients", timeout=10)
        assert r.status_code == 403

    def test_client_detail(self, admin_session, client_user, shipment):
        cid = client_user["user"]["id"]
        r = admin_session.get(f"{API}/clients/{cid}", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["client"]["email"] == client_user["user"]["email"]
        assert any(s["id"] == shipment["id"] for s in d["shipments"])

    def test_dashboard_stats(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "delivered", "pending", "in_transit", "clients", "by_status", "alerts"):
            assert k in d
        assert isinstance(d["by_status"], dict)

    def test_dashboard_forbidden_for_client(self, client_user):
        r = client_user["session"].get(f"{API}/dashboard/stats", timeout=10)
        assert r.status_code == 403
