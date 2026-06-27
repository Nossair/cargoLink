import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { formatApiError } from "../lib/api";

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", address: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await register(form);
      navigate("/app");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  const field = (k, type, testid, full) => (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{t(k)}</label>
      <input data-testid={testid} type={type} required value={form[k]} onChange={set(k)}
        className="mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <form onSubmit={submit} data-testid="register-form" className="border border-black/10 rounded-sm p-6 sm:p-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tighter">{t("register_title")}</h1>
        {error && <div data-testid="register-error" className="mt-4 text-sm text-[#FF2400] border border-[#FF2400]/30 bg-[#FF2400]/5 rounded-sm p-3">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {field("first_name", "text", "reg-first-name")}
          {field("last_name", "text", "reg-last-name")}
          {field("email", "email", "reg-email", true)}
          {field("phone", "text", "reg-phone")}
          {field("password", "password", "reg-password")}
          {field("address", "text", "reg-address", true)}
        </div>
        <button data-testid="register-submit" disabled={loading}
          className="mt-6 w-full brand-bg text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? t("loading") : t("submit")}
        </button>
        <p className="mt-4 text-sm text-muted-foreground">{t("have_account")} <Link to="/login" className="brand-text font-medium">{t("nav_login")}</Link></p>
      </form>
    </div>
  );
}
