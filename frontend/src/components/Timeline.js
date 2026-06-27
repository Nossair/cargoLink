import React from "react";
import { useI18n, STATUS_FLOW } from "../i18n";

const STATUS_COLOR = {
  demande_creee: "#9CA3AF",
  en_attente_collecte: "#FFD700",
  recu_agence: "#002FA7",
  en_transit: "#002FA7",
  en_douane: "#FF2400",
  livre: "#008A00",
};

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const color = STATUS_COLOR[status] || "#9CA3AF";
  return (
    <span
      data-testid={`status-badge-${status}`}
      className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-sm border"
      style={{ color, borderColor: color, backgroundColor: `${color}14` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {t(`st_${status}`)}
    </span>
  );
}

export function Timeline({ status, history = [] }) {
  const { t } = useI18n();
  const current = STATUS_FLOW.indexOf(status);
  return (
    <div data-testid="tracking-timeline" className="border border-black/10 rounded-sm">
      {STATUS_FLOW.map((s, i) => {
        const done = i <= current;
        const active = i === current;
        const entry = [...history].reverse().find((h) => h.status === s);
        const color = STATUS_COLOR[s];
        return (
          <div key={s} className={`flex items-start gap-4 p-4 border-b border-black/10 last:border-b-0 ${active ? "bg-secondary" : ""}`}>
            <div className="flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: done ? color : "#D1D5DB", backgroundColor: done ? color : "transparent" }} />
              {i < STATUS_FLOW.length - 1 && (
                <div className="w-0.5 h-8 mt-1" style={{ backgroundColor: i < current ? color : "#E5E7EB" }} />
              )}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{t(`st_${s}`)}</div>
              {entry && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(entry.at).toLocaleString()} {entry.note ? `· ${entry.note}` : ""}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
