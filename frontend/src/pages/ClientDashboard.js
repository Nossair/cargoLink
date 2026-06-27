import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { StatusBadge } from "../components/Timeline";
import { Plus, Package } from "@phosphor-icons/react";

export default function ClientDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [shipments, setShipments] = useState(null);

  useEffect(() => { api.get("/shipments").then((r) => setShipments(r.data)).catch(() => setShipments([])); }, []);

  return (
    <div data-testid="client-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("welcome")}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter mt-1">{user?.first_name} {user?.last_name}</h1>
        </div>
        <Link to="/app/new" data-testid="create-shipment-btn" className="inline-flex items-center gap-2 brand-bg text-white px-5 py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={18} weight="bold" /> {t("create_shipment")}
        </Link>
      </div>

      <h2 className="font-display text-xl font-bold tracking-tight mt-10 mb-4">{t("my_shipments")}</h2>
      {shipments === null ? (
        <div className="font-mono text-sm text-muted-foreground">{t("loading")}</div>
      ) : shipments.length === 0 ? (
        <div data-testid="no-shipments" className="border border-dashed border-black/15 rounded-sm p-12 text-center">
          <Package size={36} className="mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-3">{t("no_shipments")}</p>
        </div>
      ) : (
        <div className="border border-black/10 rounded-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-start p-3 font-medium">{t("tracking_number")}</th>
                <th className="text-start p-3 font-medium">{t("destination")}</th>
                <th className="text-start p-3 font-medium">{t("status")}</th>
                <th className="text-start p-3 font-medium">{t("created_at")}</th>
                <th className="text-start p-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id} data-testid={`shipment-row-${s.tracking_number}`} className="border-t border-black/10 hover:bg-secondary/50">
                  <td className="p-3 font-mono font-medium">{s.tracking_number}</td>
                  <td className="p-3">{s.recipient.first_name} {s.recipient.last_name} · {s.recipient.country}</td>
                  <td className="p-3"><StatusBadge status={s.status} /></td>
                  <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="p-3"><Link to={`/shipment/${s.id}`} data-testid={`view-shipment-${s.tracking_number}`} className="brand-text font-medium">{t("view")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
