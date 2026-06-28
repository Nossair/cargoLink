import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    address: user?.address || "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await updateProfile(form);
      toast.success(t("profile_updated"));
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
      <form onSubmit={submit} data-testid="profile-form" className="border border-black/10 rounded-sm p-6 sm:p-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tighter">{t("profile_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("profile_sub")}</p>

        <div className="mt-6">
          <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{t("email")}</label>
          <input data-testid="profile-email" type="email" value={user?.email || ""} disabled
            className="mt-1 w-full border border-black/10 bg-secondary rounded-sm px-3 py-2.5 text-sm text-muted-foreground" />
        </div>

        {error && <div data-testid="profile-error" className="mt-4 text-sm text-[#FF2400] border border-[#FF2400]/30 bg-[#FF2400]/5 rounded-sm p-3">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {field("first_name", "text", "profile-first-name")}
          {field("last_name", "text", "profile-last-name")}
          {field("phone", "text", "profile-phone")}
          {field("address", "text", "profile-address", true)}
        </div>

        <button data-testid="profile-submit" disabled={loading}
          className="mt-6 w-full brand-bg text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? t("loading") : t("save")}
        </button>
      </form>
    </div>
  );
}
