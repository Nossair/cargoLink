from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import base64
import secrets
import logging
import random
import string
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated, Literal

import jwt
import bcrypt
import qrcode
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdfcanvas

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
EUR_TO_MAD = 10.8

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------- Models ----------------
PyObjectId = Annotated[str, BeforeValidator(str)]

STATUS_FLOW = [
    "demande_creee",
    "en_attente_collecte",
    "recu_agence",
    "en_transit",
    "en_douane",
    "livre",
]


class RegisterInput(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    address: str
    password: str
    role: str = "client"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class Recipient(BaseModel):
    first_name: str
    last_name: str
    address: str
    country: str
    phone: str


class Parcel(BaseModel):
    type: str
    weight: float
    length: float = 0
    width: float = 0
    height: float = 0
    declared_value: float = 0
    category: Literal["habillement", "electronique", "alimentaire", "autre"] = "autre"


class NewClientInput(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    address: str


class ShipmentInput(BaseModel):
    recipient: Recipient
    parcel: Parcel
    origin_country: str
    pickup_mode: Literal["agency", "home"]
    pickup_slot: Optional[str] = None
    notes: Optional[str] = None
    # staff-only: create for an existing or new client
    client_id: Optional[str] = None
    new_client: Optional[NewClientInput] = None
    create_account: bool = False


class ShipmentEditInput(BaseModel):
    recipient: Recipient
    parcel: Parcel
    origin_country: str
    pickup_mode: Literal["agency", "home"]
    pickup_slot: Optional[str] = None
    notes: Optional[str] = None


class AgencyCreateInput(BaseModel):
    agency_name: str
    email: EmailStr
    phone: str
    address: str


class ClientUpdateInput(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    address: str


class AgencyUpdateInput(BaseModel):
    agency_name: str
    email: EmailStr
    phone: str
    address: str


class StatusUpdateInput(BaseModel):
    status: str
    note: Optional[str] = None


class EstimateInput(BaseModel):
    weight: float
    origin_country: str
    destination_country: str
    category: str = "autre"
    declared_value: float = 0


# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


def serialize_user(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


STAFF_ROLES = ("agent", "chef_agence", "admin", "agence")


def require_staff(user: dict):
    if user.get("role") not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé au personnel")


def require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé au super-admin")


def gen_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------------- Brute-force protection (login) ----------------
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15
_login_attempts: dict = {}  # email -> {"count": int, "locked_until": datetime|None}


def check_login_lockout(email: str):
    rec = _login_attempts.get(email)
    if rec and rec.get("locked_until") and rec["locked_until"] > datetime.now(timezone.utc):
        remaining = int((rec["locked_until"] - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        raise HTTPException(status_code=429,
                            detail=f"Trop de tentatives. Réessayez dans {remaining} minute(s).")


def record_login_failure(email: str):
    rec = _login_attempts.setdefault(email, {"count": 0, "locked_until": None})
    rec["count"] += 1
    if rec["count"] >= LOGIN_MAX_ATTEMPTS:
        rec["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
        rec["count"] = 0


def clear_login_failures(email: str):
    _login_attempts.pop(email, None)


# ---------------- Business helpers ----------------
def gen_tracking() -> str:
    return "CL" + "".join(random.choices(string.digits, k=10))


STATUS_LABELS = {
    "demande_creee": "Demande creee",
    "en_attente_collecte": "En attente de collecte",
    "recu_agence": "Recu en agence",
    "en_transit": "En transit",
    "en_douane": "En douane",
    "livre": "Livre",
    "annule": "Annule",
}
CATEGORY_LABELS = {
    "habillement": "Habillement", "electronique": "Electronique",
    "alimentaire": "Alimentaire", "autre": "Autre",
}


def build_ticket_pdf(s: dict) -> io.BytesIO:
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    W, H = A4
    brand = (0, 0.184, 0.654)  # #002FA7
    margin = 18 * mm

    # Header band
    c.setFillColorRGB(*brand)
    c.rect(0, H - 32 * mm, W, 32 * mm, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin, H - 18 * mm, "CargoLink")
    c.setFont("Helvetica", 10)
    c.drawString(margin, H - 25 * mm, "e-Ticket d'envoi  -  Logistique Europe / Maroc")
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(W - margin, H - 18 * mm, "N: " + s["tracking_number"])
    c.setFont("Helvetica", 9)
    c.drawRightString(W - margin, H - 25 * mm, "Statut: " + STATUS_LABELS.get(s["status"], s["status"]))

    # QR code
    qr_b64 = s["qr_code"].split(",", 1)[1]
    qr_img = ImageReader(io.BytesIO(base64.b64decode(qr_b64)))
    qr_size = 45 * mm
    c.drawImage(qr_img, W - margin - qr_size, H - 90 * mm, qr_size, qr_size)
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.drawCentredString(W - margin - qr_size / 2, H - 92 * mm, "Scanner ce code en agence")

    y = H - 48 * mm

    def section(title):
        nonlocal y
        c.setFillColorRGB(*brand)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, title)
        c.setStrokeColorRGB(0.85, 0.85, 0.85)
        c.line(margin, y - 2 * mm, W - margin - 50 * mm, y - 2 * mm)
        y -= 8 * mm

    def line(label, value):
        nonlocal y
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.setFont("Helvetica", 9)
        c.drawString(margin, y, label)
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(margin + 40 * mm, y, str(value))
        y -= 6 * mm

    snd, rcp, p = s["sender"], s["recipient"], s["parcel"]
    section("Expediteur")
    line("Nom", f"{snd['first_name']} {snd['last_name']}")
    line("Telephone", snd.get("phone", "-"))
    line("Adresse", snd.get("address", "-"))
    y -= 3 * mm

    section("Destinataire")
    line("Nom", f"{rcp['first_name']} {rcp['last_name']}")
    line("Telephone", rcp.get("phone", "-"))
    line("Adresse", rcp.get("address", "-"))
    line("Pays", rcp.get("country", "-"))
    y -= 3 * mm

    section("Colis")
    line("Type", p.get("type", "-"))
    line("Categorie", CATEGORY_LABELS.get(p.get("category"), p.get("category", "-")))
    line("Poids", f"{p.get('weight', 0)} kg")
    line("Dimensions", f"{p.get('length',0)} x {p.get('width',0)} x {p.get('height',0)} cm")
    line("Valeur declaree", f"{p.get('declared_value', 0)} EUR")
    line("Depart", s.get("origin_country", "-"))
    line("Collecte", "Domicile" if s.get("pickup_mode") == "home" else "Depot en agence")
    if s.get("pickup_slot"):
        line("Creneau", s["pickup_slot"])
    y -= 3 * mm

    est = s.get("estimate") or {}
    if est:
        section("Estimation des couts")
        line("Frais d'envoi", f"{est.get('shipping_eur')} EUR / {est.get('shipping_mad')} MAD")
        line("Douane (est.)", f"{est.get('customs_low_eur')} - {est.get('customs_high_eur')} EUR")
        line("Total estime", f"{est.get('total_low_eur')} - {est.get('total_high_eur')} EUR")

    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.setFont("Helvetica-Oblique", 7.5)
    c.drawString(margin, 18 * mm, "Estimation indicative - le montant reel des droits de douane sera calcule par nos services.")
    c.drawString(margin, 13 * mm, "Document genere par CargoLink. Conservez ce e-ticket jusqu'a la livraison.")

    c.showPage()
    c.save()
    buf.seek(0)
    return buf


def make_qr_data_url(content: str) -> str:
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#002FA7", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def compute_estimate(weight: float, origin: str, dest: str, category: str, declared_value: float) -> dict:
    base_per_kg = 5.0 if origin.upper().startswith("MA") else 4.5
    handling = 10.0
    cat_factor = {"habillement": 1.0, "electronique": 1.3, "alimentaire": 1.1, "autre": 1.15}.get(category, 1.15)
    shipping = (base_per_kg * max(weight, 0.5) + handling) * cat_factor
    customs_pct = {"habillement": (0.05, 0.12), "electronique": (0.10, 0.20),
                   "alimentaire": (0.0, 0.05), "autre": (0.08, 0.15)}.get(category, (0.08, 0.15))
    customs_low = declared_value * customs_pct[0]
    customs_high = declared_value * customs_pct[1]
    return {
        "shipping_eur": round(shipping, 2),
        "shipping_mad": round(shipping * EUR_TO_MAD, 2),
        "customs_low_eur": round(customs_low, 2),
        "customs_high_eur": round(customs_high, 2),
        "customs_low_mad": round(customs_low * EUR_TO_MAD, 2),
        "customs_high_mad": round(customs_high * EUR_TO_MAD, 2),
        "total_low_eur": round(shipping + customs_low, 2),
        "total_high_eur": round(shipping + customs_high, 2),
        "eur_to_mad": EUR_TO_MAD,
    }


# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    role = data.role if data.role in ("client",) else "client"
    doc = {
        "email": email, "password_hash": hash_password(data.password),
        "first_name": data.first_name, "last_name": data.last_name,
        "phone": data.phone, "address": data.address, "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    doc["_id"] = res.inserted_id
    return serialize_user(doc)


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    check_login_lockout(email)
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        record_login_failure(email)
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    clear_login_failures(email)
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return serialize_user(user)


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, user["email"]), create_refresh_token(uid))
    return serialize_user(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


@api_router.put("/auth/profile")
async def update_profile(data: dict, user: dict = Depends(get_current_user)):
    allowed = {k: data[k] for k in ("first_name", "last_name", "phone", "address") if k in data}
    await db.users.update_one({"_id": user["_id"]}, {"$set": allowed})
    updated = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(updated)


# ---------------- Estimate ----------------
@api_router.post("/estimate")
async def estimate(data: EstimateInput):
    return compute_estimate(data.weight, data.origin_country, data.destination_country,
                            data.category, data.declared_value)


# ---------------- Shipments ----------------
def serialize_shipment(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return doc


@api_router.post("/shipments")
async def create_shipment(data: ShipmentInput, user: dict = Depends(get_current_user)):
    staff = user.get("role") in STAFF_ROLES
    owner = user
    client_credentials = None

    if staff and (data.client_id or data.new_client):
        if data.client_id:
            owner = await db.users.find_one({"_id": ObjectId(data.client_id)})
            if not owner:
                raise HTTPException(status_code=404, detail="Client introuvable")
        else:
            nc = data.new_client
            email = nc.email.lower()
            existing = await db.users.find_one({"email": email})
            if existing:
                owner = existing
            else:
                cdoc = {
                    "email": email, "first_name": nc.first_name, "last_name": nc.last_name,
                    "phone": nc.phone, "address": nc.address, "role": "client",
                    "has_account": bool(data.create_account),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                if data.create_account:
                    pw = gen_password()
                    cdoc["password_hash"] = hash_password(pw)
                    client_credentials = {"email": email, "password": pw}
                cres = await db.users.insert_one(cdoc)
                cdoc["_id"] = cres.inserted_id
                owner = cdoc

    tracking = gen_tracking()
    est = compute_estimate(data.parcel.weight, data.origin_country,
                           data.recipient.country, data.parcel.category, data.parcel.declared_value)
    now = datetime.now(timezone.utc).isoformat()
    created_by_label = "Client" if not staff else (user.get("agency_name") or f"{user['first_name']} {user['last_name']}")
    doc = {
        "tracking_number": tracking,
        "qr_code": make_qr_data_url(tracking),
        "client_id": str(owner["_id"]),
        "created_by": str(user["_id"]),
        "created_by_label": created_by_label,
        "sender": {
            "first_name": owner.get("first_name", ""), "last_name": owner.get("last_name", ""),
            "phone": owner.get("phone", ""), "address": owner.get("address", ""), "email": owner.get("email", ""),
        },
        "recipient": data.recipient.model_dump(),
        "parcel": data.parcel.model_dump(),
        "origin_country": data.origin_country,
        "pickup_mode": data.pickup_mode,
        "pickup_slot": data.pickup_slot,
        "notes": data.notes,
        "estimate": est,
        "status": "demande_creee",
        "history": [{"status": "demande_creee", "note": "Demande créée", "at": now}],
        "created_at": now,
    }
    res = await db.shipments.insert_one(doc)
    doc["_id"] = res.inserted_id
    out = serialize_shipment(doc)
    if client_credentials:
        out["client_credentials"] = client_credentials
    return out


EDITABLE_STATUSES = ("demande_creee", "en_attente_collecte")


@api_router.put("/shipments/{shipment_id}")
async def edit_shipment(shipment_id: str, data: ShipmentEditInput, user: dict = Depends(get_current_user)):
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    staff = user.get("role") in STAFF_ROLES
    if not staff and doc["client_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Accès refusé")
    if doc["status"] not in EDITABLE_STATUSES:
        raise HTTPException(status_code=403, detail="Modification impossible : le colis est déjà pris en charge")
    est = compute_estimate(data.parcel.weight, data.origin_country,
                           data.recipient.country, data.parcel.category, data.parcel.declared_value)
    now = datetime.now(timezone.utc).isoformat()
    entry = {"status": doc["status"], "note": "Envoi modifié", "at": now,
             "by": user.get("agency_name") or f"{user['first_name']} {user['last_name']}"}
    await db.shipments.update_one({"_id": ObjectId(shipment_id)}, {"$set": {
        "recipient": data.recipient.model_dump(),
        "parcel": data.parcel.model_dump(),
        "origin_country": data.origin_country,
        "pickup_mode": data.pickup_mode,
        "pickup_slot": data.pickup_slot,
        "notes": data.notes,
        "estimate": est,
    }, "$push": {"history": entry}})
    updated = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    return serialize_shipment(updated)


@api_router.put("/shipments/{shipment_id}/cancel")
async def cancel_shipment(shipment_id: str, user: dict = Depends(get_current_user)):
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    staff = user.get("role") in STAFF_ROLES
    if not staff and doc["client_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Accès refusé")
    if doc["status"] not in EDITABLE_STATUSES:
        raise HTTPException(status_code=403, detail="Annulation impossible : le colis est déjà pris en charge")
    now = datetime.now(timezone.utc).isoformat()
    entry = {"status": "annule", "note": "Envoi annulé", "at": now,
             "by": user.get("agency_name") or f"{user['first_name']} {user['last_name']}"}
    await db.shipments.update_one({"_id": ObjectId(shipment_id)},
                                  {"$set": {"status": "annule"}, "$push": {"history": entry}})
    updated = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    return serialize_shipment(updated)


@api_router.get("/shipments")
async def list_shipments(user: dict = Depends(get_current_user),
                         skip: int = 0, limit: int = 1000):
    skip = max(skip, 0)
    limit = min(max(limit, 1), 1000)
    query = {} if user.get("role") in STAFF_ROLES else {"client_id": str(user["_id"])}
    cursor = db.shipments.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)
    return [serialize_shipment(d) for d in docs]


@api_router.get("/shipments/track/{tracking_number}")
async def track(tracking_number: str):
    doc = await db.shipments.find_one({"tracking_number": tracking_number})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    return serialize_shipment(doc)


@api_router.get("/shipments/{shipment_id}")
async def get_shipment(shipment_id: str, user: dict = Depends(get_current_user)):
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    if user.get("role") == "client" and doc["client_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Accès refusé")
    return serialize_shipment(doc)


@api_router.get("/shipments/{shipment_id}/ticket")
async def shipment_ticket(shipment_id: str, user: dict = Depends(get_current_user)):
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    if user.get("role") == "client" and doc["client_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Accès refusé")
    pdf = build_ticket_pdf(doc)
    headers = {"Content-Disposition": f'attachment; filename="eticket-{doc["tracking_number"]}.pdf"'}
    return StreamingResponse(pdf, media_type="application/pdf", headers=headers)



@api_router.put("/shipments/{shipment_id}/status")
async def update_status(shipment_id: str, data: StatusUpdateInput, user: dict = Depends(get_current_user)):
    require_staff(user)
    if data.status not in STATUS_FLOW:
        raise HTTPException(status_code=400, detail="Statut invalide")
    doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    entry = {"status": data.status, "note": data.note or "", "at": datetime.now(timezone.utc).isoformat(),
             "by": f"{user['first_name']} {user['last_name']}"}
    await db.shipments.update_one({"_id": ObjectId(shipment_id)},
                                  {"$set": {"status": data.status}, "$push": {"history": entry}})
    updated = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    return serialize_shipment(updated)


# Scanner: update by tracking number (staff)
@api_router.put("/scan/{tracking_number}/status")
async def scan_update(tracking_number: str, data: StatusUpdateInput, user: dict = Depends(get_current_user)):
    require_staff(user)
    doc = await db.shipments.find_one({"tracking_number": tracking_number})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    if data.status not in STATUS_FLOW:
        raise HTTPException(status_code=400, detail="Statut invalide")
    entry = {"status": data.status, "note": data.note or "", "at": datetime.now(timezone.utc).isoformat(),
             "by": f"{user['first_name']} {user['last_name']}"}
    await db.shipments.update_one({"_id": doc["_id"]},
                                  {"$set": {"status": data.status}, "$push": {"history": entry}})
    updated = await db.shipments.find_one({"_id": doc["_id"]})
    return serialize_shipment(updated)


@api_router.get("/scan/{tracking_number}")
async def scan_lookup(tracking_number: str, user: dict = Depends(get_current_user)):
    require_staff(user)
    doc = await db.shipments.find_one({"tracking_number": tracking_number})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    return serialize_shipment(doc)


# ---------------- Clients / dashboard (staff) ----------------
@api_router.get("/clients")
async def list_clients(user: dict = Depends(get_current_user),
                       skip: int = 0, limit: int = 1000):
    require_staff(user)
    skip = max(skip, 0)
    limit = min(max(limit, 1), 1000)
    docs = await db.users.find({"role": "client"}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    result = []
    for d in docs:
        s = serialize_user(d)
        s["shipment_count"] = await db.shipments.count_documents({"client_id": s["id"]})
        result.append(s)
    return result


@api_router.get("/clients/{client_id}")
async def client_detail(client_id: str, user: dict = Depends(get_current_user)):
    require_staff(user)
    c = await db.users.find_one({"_id": ObjectId(client_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Client introuvable")
    shipments = await db.shipments.find({"client_id": client_id}).sort("created_at", -1).to_list(1000)
    return {"client": serialize_user(c), "shipments": [serialize_shipment(s) for s in shipments]}


@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, data: ClientUpdateInput, user: dict = Depends(get_current_user)):
    require_staff(user)
    c = await db.users.find_one({"_id": ObjectId(client_id), "role": "client"})
    if not c:
        raise HTTPException(status_code=404, detail="Client introuvable")
    email = data.email.lower()
    dup = await db.users.find_one({"email": email, "_id": {"$ne": ObjectId(client_id)}})
    if dup:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    await db.users.update_one({"_id": ObjectId(client_id)}, {"$set": {
        "first_name": data.first_name, "last_name": data.last_name,
        "email": email, "phone": data.phone, "address": data.address,
    }})
    updated = await db.users.find_one({"_id": ObjectId(client_id)})
    return serialize_user(updated)


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    require_staff(user)
    c = await db.users.find_one({"_id": ObjectId(client_id), "role": "client"})
    if not c:
        raise HTTPException(status_code=404, detail="Client introuvable")
    await db.users.delete_one({"_id": ObjectId(client_id)})
    return {"ok": True}


@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    require_staff(user)
    total = await db.shipments.count_documents({})
    delivered = await db.shipments.count_documents({"status": "livre"})
    pending = await db.shipments.count_documents({"status": {"$in": ["demande_creee", "en_attente_collecte"]}})
    in_transit = await db.shipments.count_documents({"status": {"$in": ["en_transit", "en_douane", "recu_agence"]}})
    clients = await db.users.count_documents({"role": "client"})
    # alerts: shipments stuck (not delivered) older than 7 days
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    alerts_cursor = db.shipments.find({"status": {"$ne": "livre"}, "created_at": {"$lt": cutoff}}).limit(20)
    alerts = [serialize_shipment(d) for d in await alerts_cursor.to_list(20)]
    by_status = {}
    for s in STATUS_FLOW:
        by_status[s] = await db.shipments.count_documents({"status": s})
    return {"total": total, "delivered": delivered, "pending": pending, "in_transit": in_transit,
            "clients": clients, "by_status": by_status, "alerts": alerts}


# ---------------- Agencies (super-admin only) ----------------
@api_router.get("/agencies")
async def list_agencies(user: dict = Depends(get_current_user)):
    require_admin(user)
    docs = await db.users.find({"role": "agence"}).sort("created_at", -1).to_list(1000)
    result = []
    for d in docs:
        s = serialize_user(d)
        s["created_count"] = await db.shipments.count_documents({"created_by": s["id"]})
        result.append(s)
    return result


@api_router.post("/agencies")
async def create_agency(data: AgencyCreateInput, user: dict = Depends(get_current_user)):
    require_admin(user)
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    pw = gen_password()
    doc = {
        "email": email, "password_hash": hash_password(pw),
        "agency_name": data.agency_name, "first_name": data.agency_name, "last_name": "",
        "phone": data.phone, "address": data.address, "role": "agence",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    out = serialize_user(doc)
    out["generated_password"] = pw
    return out


@api_router.get("/agencies/{agency_id}")
async def get_agency(agency_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    a = await db.users.find_one({"_id": ObjectId(agency_id), "role": "agence"})
    if not a:
        raise HTTPException(status_code=404, detail="Agence introuvable")
    out = serialize_user(a)
    out["created_count"] = await db.shipments.count_documents({"created_by": agency_id})
    return out



@api_router.put("/agencies/{agency_id}")
async def update_agency(agency_id: str, data: AgencyUpdateInput, user: dict = Depends(get_current_user)):
    require_admin(user)
    a = await db.users.find_one({"_id": ObjectId(agency_id), "role": "agence"})
    if not a:
        raise HTTPException(status_code=404, detail="Agence introuvable")
    email = data.email.lower()
    dup = await db.users.find_one({"email": email, "_id": {"$ne": ObjectId(agency_id)}})
    if dup:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    await db.users.update_one({"_id": ObjectId(agency_id)}, {"$set": {
        "agency_name": data.agency_name, "first_name": data.agency_name,
        "email": email, "phone": data.phone, "address": data.address,
    }})
    updated = await db.users.find_one({"_id": ObjectId(agency_id)})
    return serialize_user(updated)


@api_router.delete("/agencies/{agency_id}")
async def delete_agency(agency_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    a = await db.users.find_one({"_id": ObjectId(agency_id), "role": "agence"})
    if not a:
        raise HTTPException(status_code=404, detail="Agence introuvable")
    await db.users.delete_one({"_id": ObjectId(agency_id)})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.shipments.create_index("tracking_number", unique=True)
    # seed admin + an agent
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@cargolink.ma")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "first_name": "Admin", "last_name": "CargoLink", "phone": "+212600000000",
            "address": "Casablanca, Maroc", "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    agent_email = "agent@cargolink.ma"
    if not await db.users.find_one({"email": agent_email}):
        await db.users.insert_one({
            "email": agent_email, "password_hash": hash_password("agent123"),
            "first_name": "Youssef", "last_name": "Bennani", "phone": "+212611111111",
            "address": "Agence Casablanca", "role": "agent",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    agence_email = "agence.casa@cargolink.ma"
    if not await db.users.find_one({"email": agence_email}):
        await db.users.insert_one({
            "email": agence_email, "password_hash": hash_password("agence123"),
            "agency_name": "Agence Casablanca Centre", "first_name": "Agence Casablanca Centre",
            "last_name": "", "phone": "+212622222222", "address": "Bd Mohammed V, Casablanca",
            "role": "agence", "created_at": datetime.now(timezone.utc).isoformat(),
        })


@app.on_event("shutdown")
async def shutdown():
    client.close()
