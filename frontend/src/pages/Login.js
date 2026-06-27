import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, isStaff } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { formatApiError } from "../lib/api";

const HERO = "https://images.pexels.com/photos/8555366/pexels-photo-8555366.jpeg";

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const u = await login(email, password);
      navigate(isStaff(u) ? "/back-office" : "/app");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img src={HERO} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#002FA7]/40" />
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} data-testid="login-form" className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-extrabold tracking-tighter">{t("login_title")}</h1>
          {error && <div data-testid="login-error" className="mt-4 text-sm text-[#FF2400] border border-[#FF2400]/30 bg-[#FF2400]/5 rounded-sm p-3">{error}</div>}
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{t("email")}</label>
              <input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{t("password")}</label>
              <input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]" />
            </div>
          </div>
          <button data-testid="login-submit" disabled={loading}
            className="mt-6 w-full brand-bg text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? t("loading") : t("submit")}
          </button>
          <p className="mt-4 text-sm text-muted-foreground">{t("no_account")} <Link to="/register" className="brand-text font-medium">{t("nav_register")}</Link></p>
        </form>
      </div>
    </div>
  );
}
