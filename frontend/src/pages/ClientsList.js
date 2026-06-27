import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { StatusBadge } from "../components/Timeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { User } from "@phosphor-icons/react";

export default function ClientsList() {
  const { t } = useI18n();
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => { api.get("/clients").then((r) => setClients(r.data)).catch(() => {}); }, []);

  const open = async (id) => {
    const { data } = await api.get(`/clients/${id}`);
    setDetail(data);
  };

  const filtered = clients.filter((c) =>
    q === "" || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.toLowerCase()) ||
    c.email.toLowerCase().includes(q.toLowerCase()));

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
              <th className="text-start p-3 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} data-testid={`client-row-${c.email}`} className="border-t border-black/10 hover:bg-secondary/40">
                <td className="p-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="p-3 text-muted-foreground">{c.email}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c.shipment_count}</td>
                <td className="p-3"><button data-testid={`client-view-${c.email}`} onClick={() => open(c.id)} className="brand-text font-medium">{t("view")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent data-testid="client-dialog" className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><User size={20} /> {detail.client.first_name} {detail.client.last_name}</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground">{detail.client.email} · {detail.client.phone}</div>
              <div className="text-sm">{detail.client.address}</div>
              <h4 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-4">{t("my_shipments")}</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {detail.shipments.length === 0 ? <p className="text-sm text-muted-foreground">{t("no_shipments")}</p> :
                  detail.shipments.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border border-black/10 rounded-sm p-2.5">
                      <span className="font-mono text-sm">{s.tracking_number}</span>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
