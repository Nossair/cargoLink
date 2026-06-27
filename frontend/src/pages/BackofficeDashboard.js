import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { StatusBadge } from "../components/Timeline";
import { Package, Clock, Truck, CheckCircle, Users, Warning } from "@phosphor-icons/react";

export default function BackofficeDashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {}); }, []);

  if (!stats) return <div className="max-w-7xl mx-auto px-4 py-12 font-mono text-sm text-muted-foreground">{t("loading")}</div>;

  const cards = [
    { icon: Package, label: t("stat_total"), value: stats.total, color: "#0A0A0A" },
    { icon: Clock, label: t("stat_pending"), value: stats.pending, color: "#FFD700" },
    { icon: Truck, label: t("stat_transit"), value: stats.in_transit, color: "#002FA7" },
    { icon: CheckCircle, label: t("stat_delivered"), value: stats.delivered, color: "#008A00" },
    { icon: Users, label: t("stat_clients"), value: stats.clients, color: "#4B5563" },
  ];

  return (
    <div data-testid="bo-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("dashboard")}</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 border border-black/10 rounded-sm overflow-hidden mt-8">
        {cards.map((c, i) => (
          <div key={i} data-testid={`stat-card-${i}`} className="p-6 border-r border-b lg:border-b-0 border-black/10 last:border-r-0">
            <c.icon size={22} color={c.color} weight="bold" />
            <div className="font-display text-3xl font-extrabold tracking-tighter mt-3">{c.value}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight mb-4">
          <Warning size={20} color="#FF2400" weight="bold" /> {t("alerts")}
        </h2>
        {stats.alerts.length === 0 ? (
          <div data-testid="no-alerts" className="border border-dashed border-black/15 rounded-sm p-8 text-center text-muted-foreground">{t("no_alerts")}</div>
        ) : (
          <div className="border border-[#FF2400]/30 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {stats.alerts.map((s) => (
                  <tr key={s.id} className="border-b border-black/10 last:border-0">
                    <td className="p-3 font-mono font-medium">{s.tracking_number}</td>
                    <td className="p-3">{s.recipient.country}</td>
                    <td className="p-3"><StatusBadge status={s.status} /></td>
                    <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="p-3"><Link to="/back-office/shipments" className="brand-text font-medium">{t("view")}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
