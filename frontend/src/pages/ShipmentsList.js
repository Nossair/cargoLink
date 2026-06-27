import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n, STATUS_FLOW } from "../i18n";
import { StatusBadge } from "../components/Timeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { QrCode, DownloadSimple } from "@phosphor-icons/react";

export default function ShipmentsList() {
  const { t } = useI18n();
  const [shipments, setShipments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [qrShipment, setQrShipment] = useState(null);

  const load = () => api.get("/shipments").then((r) => setShipments(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/shipments/${id}/status`, { status });
      toast.success(t("update_status"));
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const downloadTicket = async (s) => {
    try {
      const res = await api.get(`/shipments/${s.id}/ticket`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `eticket-${s.tracking_number}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("ticket_downloaded"));
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const filtered = shipments.filter((s) =>
    (filter === "all" || s.status === filter) &&
    (q === "" || s.tracking_number.includes(q) ||
      `${s.recipient.first_name} ${s.recipient.last_name}`.toLowerCase().includes(q.toLowerCase()) ||
      `${s.sender.first_name} ${s.sender.last_name}`.toLowerCase().includes(q.toLowerCase()) ||
      (s.sender.phone || "").includes(q))
  );

  return (
    <div data-testid="bo-shipments" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("all_shipments")}</h1>

      <div className="flex flex-wrap gap-3 mt-6">
        <input data-testid="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")}
          className="flex-1 min-w-[200px] border border-black/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#002FA7]" />
        <select data-testid="status-filter" value={filter} onChange={(e) => setFilter(e.target.value)}
          className="border border-black/15 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#002FA7]">
          <option value="all">{t("all")}</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{t(`st_${s}`)}</option>)}
        </select>
      </div>

      <div className="border border-black/10 rounded-sm overflow-x-auto mt-6">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-start p-3 font-medium">{t("tracking_number")}</th>
              <th className="text-start p-3 font-medium">{t("sender")}</th>
              <th className="text-start p-3 font-medium">{t("destination")}</th>
              <th className="text-start p-3 font-medium">{t("phone")}</th>
              <th className="text-start p-3 font-medium">{t("status")}</th>
              <th className="text-start p-3 font-medium">{t("update_status")}</th>
              <th className="text-start p-3 font-medium">QR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} data-testid={`bo-row-${s.tracking_number}`} className="border-t border-black/10 hover:bg-secondary/40">
                <td className="p-3 font-mono font-medium">{s.tracking_number}</td>
                <td className="p-3">{s.sender.first_name} {s.sender.last_name}</td>
                <td className="p-3">{s.recipient.first_name} {s.recipient.last_name} · {s.recipient.country}</td>
                <td className="p-3 font-mono text-xs">{s.sender.phone}</td>
                <td className="p-3"><StatusBadge status={s.status} /></td>
                <td className="p-3">
                  <select data-testid={`status-select-${s.tracking_number}`} value={s.status} onChange={(e) => updateStatus(s.id, e.target.value)}
                    className="border border-black/15 rounded-sm px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#002FA7]">
                    {STATUS_FLOW.map((st) => <option key={st} value={st}>{t(`st_${st}`)}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <button data-testid={`qr-btn-${s.tracking_number}`} onClick={() => setQrShipment(s)} className="brand-text"><QrCode size={20} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!qrShipment} onOpenChange={(o) => !o && setQrShipment(null)}>
        <DialogContent data-testid="qr-dialog" className="max-w-xs">
          <DialogHeader><DialogTitle className="font-mono">{qrShipment?.tracking_number}</DialogTitle></DialogHeader>
          {qrShipment && (
            <>
              <img src={qrShipment.qr_code} alt="QR" className="w-full border border-black/10 rounded-sm" />
              <button data-testid="dialog-download-ticket" onClick={() => downloadTicket(qrShipment)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 brand-bg text-white py-2.5 rounded-sm text-sm font-medium hover:opacity-90 transition-opacity">
                <DownloadSimple size={16} /> {t("download_ticket")}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
