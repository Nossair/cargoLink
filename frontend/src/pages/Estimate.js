import React, { useState, useEffect } from "react";
import { useI18n } from "../i18n";

const DOUANE_URL = process.env.REACT_APP_DOUANE_URL || "http://localhost:8787";

const EXAMPLES = ["used iPhone 14", "laptop", "perfume", "baby clothes", "roasted coffee"];
const COUNTRIES = [
  "France", "Spain", "Italy", "Germany", "Belgium", "Netherlands",
  "United Kingdom", "United States", "Canada", "China", "Turkey",
  "United Arab Emirates", "Saudi Arabia",
];

function money(value) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function Estimate() {
  const { t, lang } = useI18n();

  const LOADING_STAGES = [
    t("est_stage_1"),
    t("est_stage_2"),
    t("est_stage_3"),
    t("est_stage_4"),
  ];

  const [apiStatus, setApiStatus] = useState({ text: t("est_status_checking"), ok: null });
  const [form, setForm] = useState({
    description: "",
    originCountry: "France",
    itemValue: "500",
    currency: "EUR",
    transportCost: "50",
    eurMadRate: "10.8",
  });
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${DOUANE_URL}/api/status`)
      .then((r) => r.json())
      .then((d) =>
        setApiStatus({
          text: d.hasApiKey ? t("est_status_ready") : t("est_status_no_key"),
          ok: d.hasApiKey,
        })
      )
      .catch(() => setApiStatus({ text: t("est_status_offline"), ok: false }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    setStage(0);

    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, LOADING_STAGES.length - 1)),
      2200
    );

    try {
      const res = await fetch(`${DOUANE_URL}/api/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          originCountry: form.originCountry,
          itemValue: parseFloat(form.itemValue) || 0,
          currency: form.currency,
          transportCost: parseFloat(form.transportCost) || 0,
          eurMadRate: parseFloat(form.eurMadRate) || 10.8,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("est_calculating"));
      setResult(data);
      setApiStatus({ text: t("est_status_connected"), ok: true });
    } catch (err) {
      setError(err.message);
      setApiStatus({ text: t("est_status_problem"), ok: false });
    } finally {
      clearInterval(timer);
      setLoading(false);
      setStage(0);
    }
  };

  const inputCls =
    "w-full border border-black/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#002FA7] bg-white";
  const labelCls =
    "block text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1.5";

  const statusColor =
    apiStatus.ok === true
      ? "bg-green-50 text-green-700 border-green-200"
      : apiStatus.ok === false
      ? "bg-red-50 text-red-600 border-red-200"
      : "bg-secondary text-muted-foreground border-black/10";
  const dotColor =
    apiStatus.ok === true
      ? "bg-green-500"
      : apiStatus.ok === false
      ? "bg-red-500"
      : "bg-gray-400";

  const totalLabel = result
    ? result.officiallyVerified
      ? t("est_amount")
      : t("est_unverified")
    : t("est_amount");

  const breakdown = result
    ? [
        [t("est_cif"), result.cifMad, t("est_cif_detail"), false],
        [t("est_customs_duty"), result.customsDutyMad, `${result.rates.dutyRate}%`, false],
        [t("est_tpi"), result.tpiMad, `${result.rates.tpiRate}%`, false],
        [t("est_vat"), result.vatMad, `${result.rates.vatRate}%`, false],
        [t("est_total_pay"), result.totalToPayMad, "DI + TPI + TVA", true],
      ]
    : [];

  const noticeColor = result
    ? result.officialVerification?.status === "active"
      ? "bg-green-50 border-green-200 text-green-800"
      : result.officialVerification?.status === "inactive"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-blue-50 border-blue-200 text-blue-800"
    : "";

  return (
    <div data-testid="estimate-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">
            {t("nav_estimate")}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">{t("est_subtitle")}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 border rounded-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${statusColor}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {apiStatus.text}
        </span>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* ── Form panel ── */}
        <section className="border border-black/10 rounded-sm p-6">
          <h2 className="font-semibold text-base tracking-tight">{t("est_section_title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("est_hint")}</p>

          <div className="flex flex-wrap gap-2 mt-4">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setForm((f) => ({ ...f, description: ex }))}
                className="border border-black/15 rounded-sm px-3 py-1.5 text-xs font-medium hover:bg-secondary hover:border-[#002FA7] transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className={labelCls}>{t("est_what")}</label>
              <input
                value={form.description}
                onChange={set("description")}
                required
                placeholder={t("est_placeholder")}
                autoComplete="off"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{t("est_from")}</label>
              <input
                value={form.originCountry}
                onChange={set("originCountry")}
                list="countryList"
                autoComplete="country-name"
                className={inputCls}
              />
              <datalist id="countryList">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("est_item_value")}</label>
                <input
                  value={form.itemValue}
                  onChange={set("itemValue")}
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("est_currency")}</label>
                <select value={form.currency} onChange={set("currency")} className={inputCls}>
                  <option value="EUR">EUR</option>
                  <option value="MAD">MAD</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("est_transport")}</label>
              <input
                value={form.transportCost}
                onChange={set("transportCost")}
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{t("est_rate")}</label>
              <input
                value={form.eurMadRate}
                onChange={set("eurMadRate")}
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full brand-bg text-white py-2.5 rounded-sm text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {loading ? LOADING_STAGES[stage] : t("est_calculate")}
            </button>
          </form>
        </section>

        {/* ── Results panel ── */}
        <section className="space-y-4">
          {/* Total */}
          <div className="border border-black/10 rounded-sm p-6 bg-secondary/30">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {totalLabel}
              </span>
              {result && result.mfnDutyRate !== undefined && (
                <span className="text-[10px] font-semibold uppercase tracking-wide brand-bg text-white px-2 py-0.5 rounded-sm">
                  {t("est_published")}
                </span>
              )}
              {result && result.mfnDutyRate === undefined && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-sm">
                  {t("est_ai")}
                </span>
              )}
            </div>
            <div className="font-display text-5xl font-extrabold tracking-tighter">
              {result ? money(result.totalToPayMad) : "—"}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {loading
                ? LOADING_STAGES[stage]
                : result
                ? `${t("est_landed")}: ${money(result.landedCostMad)} — ${result.productName}`
                : t("est_waiting")}
            </p>
          </div>

          {/* HS Code + Route */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-black/10 rounded-sm p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {t("est_hs_code")}
              </div>
              <div className="font-mono font-bold text-lg mt-1.5">{result?.hsCode || "—"}</div>
            </div>
            <div className="border border-black/10 rounded-sm p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {t("est_route")}
              </div>
              <div className="font-mono font-bold text-lg mt-1.5">
                {result ? `${result.originCountry} → Morocco` : "—"}
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="border border-black/10 rounded-sm p-6">
            <h2 className="font-semibold text-base tracking-tight mb-4">{t("est_breakdown")}</h2>
            {result ? (
              <div>
                {breakdown.map(([label, value, detail, isTotal]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 py-2.5 border-b border-black/10 last:border-0"
                  >
                    <div>
                      <div className={`text-sm font-medium ${isTotal ? "brand-text" : ""}`}>
                        {label}
                      </div>
                      <div className="text-xs text-muted-foreground">{detail}</div>
                    </div>
                    <div
                      className={`text-sm font-semibold font-mono tabular-nums ${
                        isTotal ? "brand-text" : ""
                      }`}
                    >
                      {money(value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("est_no_estimate")}</p>
            )}
          </div>

          {/* Details */}
          <div className="border border-black/10 rounded-sm p-6">
            <h2 className="font-semibold text-base tracking-tight mb-3">{t("est_details")}</h2>
            {result ? (
              <div className={`text-sm p-4 rounded-sm border leading-relaxed ${noticeColor}`}>
                <p className="font-semibold">{result.hsDescription || result.productName}</p>
                {result.basis && <p className="mt-1">{result.basis}</p>}
                {result.tradeAgreement && (
                  <p className="mt-2">
                    <strong>{t("est_origin_treatment")}:</strong> {result.tradeAgreement}
                    {result.rateAdjustmentReason && ` — ${result.rateAdjustmentReason}`}
                  </p>
                )}
                {result.officialVerification && (
                  <p className="mt-2">
                    <strong>{t("est_adil_check")}:</strong> {result.officialVerification.message}{" "}
                    <a
                      href={result.officialVerification.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      {t("est_adil_open")}
                    </a>
                  </p>
                )}
                {result.warnings?.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="text-sm p-4 rounded-sm bg-secondary border border-black/10 text-muted-foreground">
                {t("est_details_hint")}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground leading-relaxed">{t("est_disclaimer")}</p>
        </section>
      </div>
    </div>
  );
}
