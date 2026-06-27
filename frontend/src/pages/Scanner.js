import React, { useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n, STATUS_FLOW } from "../i18n";
import { StatusBadge } from "../components/Timeline";
import { Camera, Stop, MagnifyingGlass, CheckCircle } from "@phosphor-icons/react";

export default function Scanner() {
  const { t } = useI18n();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [shipment, setShipment] = useState(null);
  const scannerRef = useRef(null);

  const lookup = async (code) => {
    try {
      const { data } = await api.get(`/scan/${code.trim()}`);
      setShipment(data);
      toast.success(t("scanned"));
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const startScan = async () => {
    setScanning(true);
    try {
      const html5 = new Html5Qrcode("qr-reader");
      scannerRef.current = html5;
      await html5.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        async (decoded) => { await stopScan(); await lookup(decoded); },
        () => {});
    } catch (e) {
      toast.error("Caméra indisponible — utilisez la saisie manuelle");
      setScanning(false);
    }
  };

  const stopScan = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const updateStatus = async (status) => {
    try {
      const { data } = await api.put(`/scan/${shipment.tracking_number}/status`, { status, note: t("deposit") });
      setShipment(data);
      toast.success(t("update_status"));
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div data-testid="scanner-page" className="max-w-md mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tighter">{t("scanner_title")}</h1>

      {!shipment && (
        <>
          <div id="qr-reader" className="mt-6 rounded-sm overflow-hidden border border-black/10" style={{ minHeight: scanning ? 300 : 0 }} />
          {!scanning ? (
            <button data-testid="scan-start" onClick={startScan}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 brand-bg text-white py-4 rounded-sm font-bold text-lg hover:opacity-90 transition-opacity">
              <Camera size={24} weight="bold" /> {t("scan_start")}
            </button>
          ) : (
            <button data-testid="scan-stop" onClick={stopScan}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 border-2 border-[#FF2400] text-[#FF2400] py-4 rounded-sm font-bold text-lg hover:bg-[#FF2400]/5 transition-colors">
              <Stop size={24} weight="bold" /> {t("scan_stop")}
            </button>
          )}
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{t("scan_manual")}</label>
            <div className="flex gap-2 mt-1">
              <input data-testid="manual-input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="CL..."
                className="flex-1 border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]" />
              <button data-testid="manual-lookup" onClick={() => lookup(manual)} className="brand-bg text-white px-4 rounded-sm"><MagnifyingGlass size={20} /></button>
            </div>
          </div>
        </>
      )}

      {shipment && (
        <div data-testid="scan-result" className="mt-6">
          <div className="border border-black/10 rounded-sm p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-lg">{shipment.tracking_number}</span>
              <StatusBadge status={shipment.status} />
            </div>
            <div className="mt-4 text-sm space-y-1">
              <div><span className="text-muted-foreground">{t("sender")}: </span>{shipment.sender.first_name} {shipment.sender.last_name}</div>
              <div><span className="text-muted-foreground">{t("recipient")}: </span>{shipment.recipient.first_name} {shipment.recipient.last_name}</div>
              <div><span className="text-muted-foreground">{t("destination")}: </span>{shipment.recipient.address}, {shipment.recipient.country}</div>
            </div>
          </div>

          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-6 mb-3">{t("select_action")}</h3>
          <div className="grid grid-cols-1 gap-2">
            {STATUS_FLOW.slice(1).map((st) => (
              <button key={st} data-testid={`action-${st}`} onClick={() => updateStatus(st)}
                className={`flex items-center justify-between p-4 rounded-sm border text-start transition-colors ${shipment.status === st ? "border-[#002FA7] bg-[#002FA7]/5" : "border-black/15 hover:bg-secondary"}`}>
                <span className="font-medium">{t(`st_${st}`)}</span>
                {shipment.status === st && <CheckCircle size={20} weight="fill" className="brand-text" />}
              </button>
            ))}
          </div>
          <button data-testid="scan-again" onClick={() => { setShipment(null); setManual(""); }}
            className="mt-6 w-full border border-black/15 py-3 rounded-sm font-medium hover:bg-secondary transition-colors">
            {t("scan_start")}
          </button>
        </div>
      )}
    </div>
  );
}
