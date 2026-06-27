import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n } from "../i18n";
import { EstimateView } from "./NewShipment";
import { Buildings, House, Calculator } from "@phosphor-icons/react";

const COUNTRIES = ["Maroc", "France", "Espagne", "Belgique", "Italie", "Allemagne", "Pays-Bas"];
const CATEGORIES = ["habillement", "electronique", "alimentaire", "autre"];

export default function EditShipment() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [r, setR] = useState({ first_name: "", last_name: "", address: "", country: "Maroc", phone: "" });
  const [p, setP] = useState({ type: "", weight: "", length: "", width: "", height: "", declared_value: "", category: "autre" });
  const [origin, setOrigin] = useState("France");
  const [pickup, setPickup] = useState("agency");
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/shipments/${id}`).then(({ data }) => {
      setR(data.recipient);
      setP({ ...data.parcel, weight: String(data.parcel.weight), length: String(data.parcel.length || ""), width: String(data.parcel.width || ""), height: String(data.parcel.height || ""), declared_value: String(data.parcel.declared_value || "") });
      setOrigin(data.origin_country);
      setPickup(data.pickup_mode);
      setSlot(data.pickup_slot || "");
      setNotes(data.notes || "");
      setEstimate(data.estimate);
      setLoaded(true);
    }).catch(() => { toast.error(t("loading")); navigate("/app"); });
  }, [id]);

  const doEstimate = async () => {
    const { data } = await api.post("/estimate", {
      weight: parseFloat(p.weight || 0), origin_country: origin, destination_country: r.country,
      category: p.category, declared_value: parseFloat(p.declared_value || 0),
    });
    setEstimate(data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.put(`/shipments/${id}`, {
        recipient: r,
        parcel: {
          type: p.type, weight: parseFloat(p.weight), length: parseFloat(p.length || 0),
          width: parseFloat(p.width || 0), height: parseFloat(p.height || 0),
          declared_value: parseFloat(p.declared_value || 0), category: p.category,
        },
        origin_country: origin, pickup_mode: pickup, pickup_slot: slot || null, notes,
      });
      toast.success(t("save_changes"));
      navigate(`/shipment/${data.id}`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const inp = (val, on, props = {}) => (
    <input value={val} onChange={(e) => on(e.target.value)} {...props}
      className="mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]" />
  );
  const Label = ({ children }) => <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{children}</label>;

  if (!loaded) return <div className="max-w-4xl mx-auto px-4 py-12 font-mono text-sm text-muted-foreground">{t("loading")}</div>;

  return (
    <div data-testid="edit-shipment-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("edit_shipment")}</h1>
      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="border border-black/10 rounded-sm p-6">
          <h2 className="font-display text-lg font-bold tracking-tight mb-4">{t("recipient")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>{t("first_name")}</Label>{inp(r.first_name, (v) => setR({ ...r, first_name: v }), { required: true, "data-testid": "rcpt-first-name" })}</div>
            <div><Label>{t("last_name")}</Label>{inp(r.last_name, (v) => setR({ ...r, last_name: v }), { required: true, "data-testid": "rcpt-last-name" })}</div>
            <div className="sm:col-span-2"><Label>{t("address")}</Label>{inp(r.address, (v) => setR({ ...r, address: v }), { required: true, "data-testid": "rcpt-address" })}</div>
            <div>
              <Label>{t("country")}</Label>
              <select data-testid="rcpt-country" value={r.country} onChange={(e) => setR({ ...r, country: e.target.value })}
                className="mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7] bg-white">
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>{t("phone")}</Label>{inp(r.phone, (v) => setR({ ...r, phone: v }), { required: true, "data-testid": "rcpt-phone" })}</div>
          </div>
        </section>

        <section className="border border-black/10 rounded-sm p-6">
          <h2 className="font-display text-lg font-bold tracking-tight mb-4">{t("parcel")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("origin_country")}</Label>
              <select data-testid="origin-country" value={origin} onChange={(e) => setOrigin(e.target.value)}
                className="mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]">
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>{t("parcel_type")}</Label>{inp(p.type, (v) => setP({ ...p, type: v }), { required: true, "data-testid": "parcel-type" })}</div>
            <div>
              <Label>{t("category")}</Label>
              <select data-testid="parcel-category" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}
                className="mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]">
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
              </select>
            </div>
            <div><Label>{t("weight")}</Label>{inp(p.weight, (v) => setP({ ...p, weight: v }), { required: true, type: "number", step: "0.1", min: "0", "data-testid": "parcel-weight" })}</div>
            <div><Label>{t("declared_value")}</Label>{inp(p.declared_value, (v) => setP({ ...p, declared_value: v }), { type: "number", min: "0", "data-testid": "parcel-value" })}</div>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <div><Label>{t("length")}</Label>{inp(p.length, (v) => setP({ ...p, length: v }), { type: "number", "data-testid": "parcel-length" })}</div>
              <div><Label>{t("width")}</Label>{inp(p.width, (v) => setP({ ...p, width: v }), { type: "number", "data-testid": "parcel-width" })}</div>
              <div><Label>{t("height")}</Label>{inp(p.height, (v) => setP({ ...p, height: v }), { type: "number", "data-testid": "parcel-height" })}</div>
            </div>
          </div>
        </section>

        <section className="border border-black/10 rounded-sm p-6">
          <h2 className="font-display text-lg font-bold tracking-tight mb-4">{t("pickup_mode")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button type="button" data-testid="pickup-agency" onClick={() => setPickup("agency")}
              className={`flex items-center gap-3 p-4 rounded-sm border transition-colors ${pickup === "agency" ? "border-[#002FA7] bg-[#002FA7]/5" : "border-black/15 hover:bg-secondary"}`}>
              <Buildings size={24} className={pickup === "agency" ? "brand-text" : ""} /> <span className="font-medium">{t("pickup_agency")}</span>
            </button>
            <button type="button" data-testid="pickup-home" onClick={() => setPickup("home")}
              className={`flex items-center gap-3 p-4 rounded-sm border transition-colors ${pickup === "home" ? "border-[#002FA7] bg-[#002FA7]/5" : "border-black/15 hover:bg-secondary"}`}>
              <House size={24} className={pickup === "home" ? "brand-text" : ""} /> <span className="font-medium">{t("pickup_home")}</span>
            </button>
          </div>
          {pickup === "home" && (<div className="mt-4"><Label>{t("pickup_slot")}</Label>{inp(slot, setSlot, { type: "datetime-local", "data-testid": "pickup-slot" })}</div>)}
          <div className="mt-4"><Label>{t("notes")}</Label>{inp(notes, setNotes, { "data-testid": "notes" })}</div>
        </section>

        <section className="border border-black/10 rounded-sm p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight">{t("estimate_cost")}</h2>
            <button type="button" data-testid="estimate-btn" onClick={doEstimate}
              className="inline-flex items-center gap-2 border border-black/15 px-4 py-2 rounded-sm text-sm font-medium hover:bg-secondary transition-colors">
              <Calculator size={16} /> {t("estimate_cost")}
            </button>
          </div>
          {estimate && <EstimateView estimate={estimate} />}
        </section>

        <button data-testid="save-shipment-button" disabled={loading}
          className="w-full brand-bg text-white py-3 rounded-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? t("loading") : t("save_changes")}
        </button>
      </form>
    </div>
  );
}
