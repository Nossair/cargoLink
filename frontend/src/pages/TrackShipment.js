import React, { useState } from "react";
import api, { formatApiError } from "../lib/api";
import { useI18n } from "../i18n";
import { Timeline, StatusBadge } from "../components/Timeline";
import { MagnifyingGlass } from "@phosphor-icons/react";

export default function TrackShipment() {
  const { t } = useI18n();
  const [num, setNum] = useState("");
  const [shipment, setShipment] = useState(null);
  const [error, setError] = useState("");

  const search = async (e) => {
    e.preventDefault();
    setError(""); setShipment(null);
    try {
      const { data } = await api.get(`/shipments/track/${num.trim()}`);
      setShipment(data);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <div data-testid="track-page" className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("track_title")}</h1>
      <form onSubmit={search} className="mt-6 flex gap-2">
        <input data-testid="track-input" value={num} onChange={(e) => setNum(e.target.value)} placeholder={t("track_placeholder")}
          className="flex-1 border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]" />
        <button data-testid="track-search" className="inline-flex items-center gap-2 brand-bg text-white px-5 rounded-sm font-medium hover:opacity-90 transition-opacity">
          <MagnifyingGlass size={18} /> {t("track_btn")}
        </button>
      </form>
      {error && <div data-testid="track-error" className="mt-4 text-sm text-[#FF2400] border border-[#FF2400]/30 bg-[#FF2400]/5 rounded-sm p-3">{error}</div>}
      {shipment && (
        <div data-testid="track-result" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("tracking_number")}</div>
              <div className="font-mono font-bold text-lg">{shipment.tracking_number}</div>
            </div>
            <StatusBadge status={shipment.status} />
          </div>
          <Timeline status={shipment.status} history={shipment.history} />
        </div>
      )}
    </div>
  );
}
