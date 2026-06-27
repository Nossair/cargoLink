import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth, isStaff } from "../context/AuthContext";
import { QrCode, MapPin, Calculator, ArrowRight } from "@phosphor-icons/react";

const HERO = "https://images.pexels.com/photos/8555366/pexels-photo-8555366.jpeg";

export default function Landing() {
  const { t } = useI18n();
  const { user } = useAuth();
  const home = user ? (isStaff(user) ? "/back-office" : "/app") : "/register";

  const features = [
    { icon: QrCode, k: "feature_qr", d: "feature_qr_d" },
    { icon: MapPin, k: "feature_track", d: "feature_track_d" },
    { icon: Calculator, k: "feature_cost", d: "feature_cost_d" },
  ];

  return (
    <div data-testid="landing-page">
      <section className="relative">
        <div className="absolute inset-0">
          <img src={HERO} alt="cargo" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 sm:py-36">
          <div className="max-w-2xl animate-fade-up">
            <div className="text-xs uppercase tracking-[0.2em] font-medium text-[#FFD700] mb-4">{t("tagline")}</div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter font-black text-white leading-[1.05]">{t("hero_title")}</h1>
            <p className="text-base sm:text-lg text-white/80 mt-6 leading-relaxed">{t("hero_sub")}</p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to={home} data-testid="hero-cta" className="inline-flex items-center gap-2 brand-bg text-white px-6 py-3 rounded-sm font-medium hover:opacity-90 transition-opacity">
                {t("hero_cta")} <ArrowRight size={18} weight="bold" />
              </Link>
              <Link to="/track" data-testid="hero-track" className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white border border-white/30 px-6 py-3 rounded-sm font-medium hover:bg-white/20 transition-colors">
                {t("hero_track")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 border border-black/10 rounded-sm overflow-hidden">
          {features.map((f, i) => (
            <div key={i} data-testid={`feature-${i}`} className="p-8 border-b md:border-b-0 md:border-r border-black/10 last:border-r-0 hover:bg-secondary transition-colors">
              <div className="w-12 h-12 brand-bg rounded-sm flex items-center justify-center mb-5">
                <f.icon size={24} color="#fff" weight="bold" />
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight">{t(f.k)}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{t(f.d)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
