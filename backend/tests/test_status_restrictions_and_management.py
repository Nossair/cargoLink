"""Backend tests for new business rules:
- Modification/cancellation of shipment restricted to status in {demande_creee, en_attente_collecte}
  for ALL roles (admin/agence/agent/client)
- Cancel shipment -> status 'annule'
- Client management (PUT/DELETE /api/clients/{id}) by agence + admin
- Agency management (PUT/DELETE /api/agencies/{id}) admin-only (agence -> 403)
"""
import os
import random
import string
import requests
import pytest

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url
    # fallback: read from frontend/.env
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    try:
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@cargolink.ma", "password": "admin123"}
AGENCE = {"email": "agence.casa@cargolink.ma", "password": "agence123"}
AGENT = {"email": "agent@cargolink.ma", "password": "agent123"}


def rsuf(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_s():
    return login(ADMIN)


@pytest.fixture(scope="module")
def agence_s():
    return login(AGENCE)


@pytest.fixture(scope="module")
def agent_s():
    return login(AGENT)


def _ship_payload():
    return {
        "recipient": {"first_name": "Ali", "last_name": "Bennani",
                      "address": "Rabat", "country": "MA", "phone": "+212600000000"},
        "parcel": {"type": "box", "weight": 3.5, "declared_value": 100.0, "category": "habillement"},
        "origin_country": "FR",
        "pickup_mode": "agency",
    }


def _edit_payload(weight=4.2, first="Updated"):
    return {
        "recipient": {"first_name": first, "last_name": "Bennani",
                      "address": "Rabat", "country": "MA", "phone": "+212600000000"},
        "parcel": {"type": "box", "weight": weight, "declared_value": 100.0, "category": "habillement"},
        "origin_country": "FR",
        "pickup_mode": "agency",
    }


def _register_client():
    s = requests.Session()
    email = f"TEST_{rsuf()}@test.com"
    r = s.post(f"{API}/auth/register", json={
        "first_name": "T", "last_name": "C", "email": email,
        "phone": "+33611", "address": "Paris", "password": "pw12345",
    }, timeout=15)
    assert r.status_code == 200, r.text
    return s, r.json()["id"], email


# ----------------- Cancel + status-restricted edit -----------------
class TestCancelShipment:
    def test_client_can_cancel_own_shipment_demande_creee(self):
        s, cid, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        assert r.status_code == 200
        sid = r.json()["id"]
        # Cancel
        rc = s.put(f"{API}/shipments/{sid}/cancel", timeout=10)
        assert rc.status_code == 200, rc.text
        body = rc.json()
        assert body["status"] == "annule"
        assert any(h.get("status") == "annule" for h in body["history"])
        # GET to verify persistence
        g = s.get(f"{API}/shipments/{sid}", timeout=10)
        assert g.status_code == 200
        assert g.json()["status"] == "annule"

    def test_agence_can_cancel_any_shipment_in_editable_status(self, agence_s):
        s, cid, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        rc = agence_s.put(f"{API}/shipments/{sid}/cancel", timeout=10)
        assert rc.status_code == 200
        assert rc.json()["status"] == "annule"

    def test_cancel_fails_when_status_advanced(self, agence_s, admin_s):
        s, cid, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        # Advance status to en_transit (staff-only)
        rs = admin_s.put(f"{API}/shipments/{sid}/status",
                         json={"status": "en_transit", "note": "move"}, timeout=10)
        assert rs.status_code == 200
        # Now cancel by client -> 403
        rc_client = s.put(f"{API}/shipments/{sid}/cancel", timeout=10)
        assert rc_client.status_code == 403
        # And cancel by agence -> 403
        rc_ag = agence_s.put(f"{API}/shipments/{sid}/cancel", timeout=10)
        assert rc_ag.status_code == 403
        # And admin -> 403
        rc_ad = admin_s.put(f"{API}/shipments/{sid}/cancel", timeout=10)
        assert rc_ad.status_code == 403

    def test_other_client_cannot_cancel(self):
        s1, _, _ = _register_client()
        r = s1.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        s2, _, _ = _register_client()
        rc = s2.put(f"{API}/shipments/{sid}/cancel", timeout=10)
        assert rc.status_code == 403


class TestEditRestrictedForAllRoles:
    """New rule: edit allowed ONLY when status in EDITABLE_STATUSES for ALL roles."""

    def test_admin_cannot_edit_in_transit(self, admin_s):
        s, _, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        admin_s.put(f"{API}/shipments/{sid}/status",
                    json={"status": "en_transit", "note": "x"}, timeout=10)
        re = admin_s.put(f"{API}/shipments/{sid}", json=_edit_payload(), timeout=10)
        assert re.status_code == 403, f"admin should not be able to edit in_transit, got {re.status_code}: {re.text}"

    def test_agence_cannot_edit_in_transit(self, admin_s, agence_s):
        s, _, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        admin_s.put(f"{API}/shipments/{sid}/status",
                    json={"status": "en_transit", "note": "x"}, timeout=10)
        re = agence_s.put(f"{API}/shipments/{sid}", json=_edit_payload(), timeout=10)
        assert re.status_code == 403

    def test_agent_cannot_edit_in_transit(self, admin_s, agent_s):
        s, _, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        admin_s.put(f"{API}/shipments/{sid}/status",
                    json={"status": "en_transit", "note": "x"}, timeout=10)
        re = agent_s.put(f"{API}/shipments/{sid}", json=_edit_payload(), timeout=10)
        assert re.status_code == 403

    def test_client_cannot_edit_in_transit(self, admin_s):
        s, _, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        admin_s.put(f"{API}/shipments/{sid}/status",
                    json={"status": "en_transit", "note": "x"}, timeout=10)
        re = s.put(f"{API}/shipments/{sid}", json=_edit_payload(), timeout=10)
        assert re.status_code == 403

    def test_edit_allowed_in_editable_status_for_all_roles(self, admin_s, agence_s):
        # Client edit
        s, _, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        re = s.put(f"{API}/shipments/{sid}", json=_edit_payload(weight=4.2), timeout=10)
        assert re.status_code == 200
        # Agence edit
        re2 = agence_s.put(f"{API}/shipments/{sid}", json=_edit_payload(weight=5.5), timeout=10)
        assert re2.status_code == 200
        assert re2.json()["parcel"]["weight"] == 5.5
        # Admin edit (still in editable status: demande_creee)
        re3 = admin_s.put(f"{API}/shipments/{sid}", json=_edit_payload(weight=6.6), timeout=10)
        assert re3.status_code == 200
        assert re3.json()["parcel"]["weight"] == 6.6

    def test_edit_after_cancel_is_forbidden(self, agence_s):
        s, _, _ = _register_client()
        r = s.post(f"{API}/shipments", json=_ship_payload(), timeout=15)
        sid = r.json()["id"]
        agence_s.put(f"{API}/shipments/{sid}/cancel", timeout=10)
        re = agence_s.put(f"{API}/shipments/{sid}", json=_edit_payload(), timeout=10)
        assert re.status_code == 403


# ----------------- Client management -----------------
class TestClientManagement:
    def test_agence_can_update_and_delete_client(self, agence_s):
        s, cid, email = _register_client()
        # update
        new_email = f"TEST_upd_{rsuf()}@test.com"
        ru = agence_s.put(f"{API}/clients/{cid}", json={
            "first_name": "UpdF", "last_name": "UpdL", "email": new_email,
            "phone": "+33700", "address": "Lyon",
        }, timeout=10)
        assert ru.status_code == 200, ru.text
        body = ru.json()
        assert body["email"] == new_email.lower()
        assert body["first_name"] == "UpdF"
        # GET verify persistence via /clients
        lc = agence_s.get(f"{API}/clients", timeout=10)
        assert any(c["id"] == cid and c["email"] == new_email.lower() for c in lc.json())
        # delete
        rd = agence_s.delete(f"{API}/clients/{cid}", timeout=10)
        assert rd.status_code == 200
        # verify removed
        lc2 = agence_s.get(f"{API}/clients", timeout=10)
        assert all(c["id"] != cid for c in lc2.json())

    def test_admin_can_update_and_delete_client(self, admin_s):
        s, cid, _ = _register_client()
        ru = admin_s.put(f"{API}/clients/{cid}", json={
            "first_name": "A", "last_name": "B", "email": f"TEST_a_{rsuf()}@test.com",
            "phone": "+1", "address": "x",
        }, timeout=10)
        assert ru.status_code == 200
        rd = admin_s.delete(f"{API}/clients/{cid}", timeout=10)
        assert rd.status_code == 200

    def test_client_cannot_update_or_delete_other_client(self):
        s1, cid1, _ = _register_client()
        s2, _, _ = _register_client()
        ru = s2.put(f"{API}/clients/{cid1}", json={
            "first_name": "x", "last_name": "y", "email": "z@z.com",
            "phone": "+1", "address": "x",
        }, timeout=10)
        assert ru.status_code == 403
        rd = s2.delete(f"{API}/clients/{cid1}", timeout=10)
        assert rd.status_code == 403

    def test_update_client_duplicate_email_returns_400(self, agence_s):
        _, cid, _ = _register_client()
        ru = agence_s.put(f"{API}/clients/{cid}", json={
            "first_name": "x", "last_name": "y",
            "email": ADMIN["email"],  # dup against admin
            "phone": "+1", "address": "x",
        }, timeout=10)
        assert ru.status_code == 400


# ----------------- Agency management -----------------
class TestAgencyManagement:
    def test_agence_cannot_update_or_delete_agency(self, admin_s, agence_s):
        # create an agency via admin
        email = f"test_ag_{rsuf()}@cargolink.ma"
        r = admin_s.post(f"{API}/agencies", json={
            "agency_name": "Ag Test", "email": email,
            "phone": "+1", "address": "x",
        }, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]

        ru = agence_s.put(f"{API}/agencies/{aid}", json={
            "agency_name": "Hack", "email": email, "phone": "+1", "address": "x",
        }, timeout=10)
        assert ru.status_code == 403
        rd = agence_s.delete(f"{API}/agencies/{aid}", timeout=10)
        assert rd.status_code == 403

        # admin can clean up
        admin_s.delete(f"{API}/agencies/{aid}", timeout=10)

    def test_admin_can_update_and_delete_agency(self, admin_s):
        email = f"test_ag_{rsuf()}@cargolink.ma"
        r = admin_s.post(f"{API}/agencies", json={
            "agency_name": "Ag Test", "email": email,
            "phone": "+1", "address": "x",
        }, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]

        new_email = f"test_agU_{rsuf()}@cargolink.ma"
        ru = admin_s.put(f"{API}/agencies/{aid}", json={
            "agency_name": "Ag Updated", "email": new_email,
            "phone": "+2", "address": "y",
        }, timeout=10)
        assert ru.status_code == 200, ru.text
        assert ru.json()["agency_name"] == "Ag Updated"
        assert ru.json()["email"] == new_email.lower()

        rd = admin_s.delete(f"{API}/agencies/{aid}", timeout=10)
        assert rd.status_code == 200

        # verify removed
        lc = admin_s.get(f"{API}/agencies", timeout=10)
        assert all(a["id"] != aid for a in lc.json())
