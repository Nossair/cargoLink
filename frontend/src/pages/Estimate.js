import React from "react";
import { useI18n } from "../i18n";

export default function Estimate() {
  const { t } = useI18n();
  return (
    <div data-testid="estimate-page" className="w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-2">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("nav_estimate")}</h1>
      </div>
      <div className="w-full" style={{ height: "calc(100vh - 8rem)" }}>
        <iframe
          data-testid="estimate-iframe"
          title="Estimateur douane"
          src="https://douane-lovat.vercel.app/"
          className="w-full h-full border-0"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
