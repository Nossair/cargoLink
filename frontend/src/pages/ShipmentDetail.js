import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useI18n } from "../i18n";
import { Timeline, StatusBadge } from "../components/Timeline";
import { EstimateView } from "./NewShipment";
import { DownloadSimple } from "@phosphor-icons/react";

export default function ShipmentDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [s, setS] = useState(null);

  useEffect(() => { api.get(`/shipments/${id}`).then((r) => setS(r.data)).catch(() => setS(false)); }, [id]);

  if (s === null) return <div className="max-w-5xl mx-auto px-4 py-12 font-mono text-sm text-muted-foreground">{t("loading")}</div>;
  if (!s) return <div className="max-w-5xl mx-auto px-4 py-12 text-[#FF2400]">404</div>;

  const download = async () => {
    try {
      const res = await api.get(`/shipments/${id}/ticket`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `eticket-${s.tracking_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {}
  };

  const Row = ({ label, value }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-black/10 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-end">{value}</span>
    </div>
  );

  return (
    <div data-testid="shipment-detail" className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("tracking_number")}</div>
          <h1 className="font-mono font-bold text-2xl">{s.tracking_number}</h1>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-black/10 rounded-sm p-6">
            <h2 className="font-display text-lg font-bold tracking-tight mb-3">{t("history")}</h2>
            <Timeline status={s.status} history={s.history} />
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="border border-black/10 rounded-sm p-6">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">{t("recipient")}</h3>
              <Row label={t("first_name")} value={`${s.recipient.first_name} ${s.recipient.last_name}`} />
              <Row label={t("address")} value={s.recipient.address} />
              <Row label={t("country")} value={s.recipient.country} />
              <Row label={t("phone")} value={s.recipient.phone} />
            </div>
            <div className="border border-black/10 rounded-sm p-6">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">{t("parcel")}</h3>
              <Row label={t("parcel_type")} value={s.parcel.type} />
              <Row label={t("category")} value={t(`cat_${s.parcel.category}`)} />
              <Row label={t("weight")} value={`${s.parcel.weight} kg`} />
              <Row label={t("declared_value")} value={`${s.parcel.declared_value} €`} />
            </div>
          </div>
          {s.estimate && <div className="border border-black/10 rounded-sm p-6"><h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("estimate_cost")}</h3><EstimateView estimate={s.estimate} /></div>}
        </div>

        <div className="border border-black/10 rounded-sm p-6 h-fit">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">{t("eticket")}</h3>
          <img data-testid="qr-image" src={s.qr_code} alt="QR" className="w-full border border-black/10 rounded-sm" />
          <button data-testid="download-qr" onClick={download} className="mt-4 w-full inline-flex items-center justify-center gap-2 brand-bg text-white py-2.5 rounded-sm text-sm font-medium hover:opacity-90 transition-opacity">
            <DownloadSimple size={16} /> {t("download_ticket")}
          </button>
        </div>
      </div>
    </div>
  );
}
