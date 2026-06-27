import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { CaretRight } from "@phosphor-icons/react";

export default function ClientsList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/clients").then((r) => setClients(r.data)).catch(() => {}); }, []);

  const filtered = clients.filter((c) =>
    q === "" || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.toLowerCase()) ||
    c.email.toLowerCase().includes(q.toLowerCase()) || (c.phone || "").includes(q));

  return (
    <div data-testid="bo-clients" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("nav_clients")}</h1>
      <input data-testid="client-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")}
        className="mt-6 w-full max-w-md border border-black/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#002FA7]" />

      <div className="border border-black/10 rounded-sm overflow-x-auto mt-6">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-start p-3 font-medium">{t("first_name")}</th>
              <th className="text-start p-3 font-medium">{t("email")}</th>
              <th className="text-start p-3 font-medium">{t("phone")}</th>
              <th className="text-start p-3 font-medium">{t("my_shipments")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} data-testid={`client-row-${c.email}`} onClick={() => navigate(`/back-office/clients/${c.id}`)}
                className="border-t border-black/10 hover:bg-secondary/50 cursor-pointer transition-colors">
                <td className="p-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="p-3 text-muted-foreground">{c.email}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c.shipment_count}</td>
                <td className="p-3 text-end"><CaretRight size={16} className="inline text-muted-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
