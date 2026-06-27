import React, { useState } from "react";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { EstimateView } from "./NewShipment";
import { Calculator } from "@phosphor-icons/react";

const COUNTRIES = ["Maroc", "France", "Espagne", "Belgique", "Italie", "Allemagne", "Pays-Bas"];
const CATEGORIES = ["habillement", "electronique", "alimentaire", "autre"];

export default function Estimate() {
  const { t } = useI18n();
  const [f, setF] = useState({ weight: "", origin_country: "France", destination_country: "Maroc", category: "autre", declared_value: "" });
  const [res, setRes] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const { data } = await api.post("/estimate", {
      weight: parseFloat(f.weight || 0), origin_country: f.origin_country,
      destination_country: f.destination_country, category: f.category,
      declared_value: parseFloat(f.declared_value || 0),
    });
    setRes(data);
  };

  const cls = "mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#002FA7]";
  const Label = ({ children }) => <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{children}</label>;

  return (
    <div data-testid="estimate-page" className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("nav_estimate")}</h1>
      <form onSubmit={submit} className="mt-8 border border-black/10 rounded-sm p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><Label>{t("origin_country")}</Label>
          <select data-testid="est-origin" value={f.origin_country} onChange={set("origin_country")} className={cls}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><Label>{t("destination")}</Label>
          <select data-testid="est-dest" value={f.destination_country} onChange={set("destination_country")} className={cls}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><Label>{t("category")}</Label>
          <select data-testid="est-category" value={f.category} onChange={set("category")} className={cls}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}</select></div>
        <div><Label>{t("weight")}</Label><input data-testid="est-weight" type="number" step="0.1" required value={f.weight} onChange={set("weight")} className={cls} /></div>
        <div className="sm:col-span-2"><Label>{t("declared_value")}</Label><input data-testid="est-value" type="number" value={f.declared_value} onChange={set("declared_value")} className={cls} /></div>
        <button data-testid="est-submit" className="sm:col-span-2 inline-flex items-center justify-center gap-2 brand-bg text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity">
          <Calculator size={18} /> {t("estimate_cost")}
        </button>
      </form>
      {res && <EstimateView estimate={res} />}
    </div>
  );
}
