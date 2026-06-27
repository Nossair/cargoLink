import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n } from "../i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Buildings, Plus, Copy, CheckCircle, PencilSimple, Trash } from "@phosphor-icons/react";

export default function Agencies() {
  const { t } = useI18n();
  const [agencies, setAgencies] = useState([]);
  const [form, setForm] = useState({ agency_name: "", email: "", phone: "", address: "" });
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = () => api.get("/agencies").then((r) => setAgencies(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/agencies/${edit.id}`, {
        agency_name: edit.agency_name, email: edit.email, phone: edit.phone, address: edit.address,
      });
      toast.success(t("agency_updated"));
      setEdit(null); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const remove = async (a) => {
    if (!window.confirm(t("confirm_delete_agency"))) return;
    try {
      await api.delete(`/agencies/${a.id}`);
      toast.success(t("agency_deleted")); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/agencies", form);
      setCreated(data);
      setForm({ agency_name: "", email: "", phone: "", address: "" });
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const cls = "mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]";
  const Label = ({ children }) => <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{children}</label>;

  return (
    <div data-testid="agencies-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("agencies_title")}</h1>

      <div className="grid lg:grid-cols-3 gap-8 mt-8">
        <form onSubmit={submit} data-testid="create-agency-form" className="border border-black/10 rounded-sm p-6 h-fit">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight mb-4"><Plus size={18} /> {t("create_agency")}</h2>
          <div className="space-y-4">
            <div><Label>{t("agency_name")}</Label><input data-testid="agency-name" required value={form.agency_name} onChange={set("agency_name")} className={cls} /></div>
            <div><Label>{t("email")}</Label><input data-testid="agency-email" type="email" required value={form.email} onChange={set("email")} className={cls} /></div>
            <div><Label>{t("phone")}</Label><input data-testid="agency-phone" required value={form.phone} onChange={set("phone")} className={cls} /></div>
            <div><Label>{t("address")}</Label><input data-testid="agency-address" required value={form.address} onChange={set("address")} className={cls} /></div>
          </div>
          <button data-testid="agency-submit" disabled={loading} className="mt-6 w-full brand-bg text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? t("loading") : t("create_agency")}
          </button>
        </form>

        <div className="lg:col-span-2 border border-black/10 rounded-sm overflow-x-auto h-fit">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-start p-3 font-medium">{t("agency_name")}</th>
                <th className="text-start p-3 font-medium">{t("email")}</th>
                <th className="text-start p-3 font-medium">{t("phone")}</th>
                <th className="text-start p-3 font-medium">{t("created_count")}</th>
                <th className="text-start p-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.id} data-testid={`agency-row-${a.email}`} className="border-t border-black/10">
                  <td className="p-3 font-medium flex items-center gap-2"><Buildings size={16} className="brand-text" /> {a.agency_name}</td>
                  <td className="p-3 text-muted-foreground">{a.email}</td>
                  <td className="p-3">{a.phone}</td>
                  <td className="p-3">{a.created_count}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <button data-testid={`agency-edit-${a.email}`} onClick={() => setEdit({ ...a })} className="inline-flex items-center gap-1 font-medium hover:brand-text transition-colors"><PencilSimple size={15} /> {t("edit")}</button>
                      <button data-testid={`agency-delete-${a.email}`} onClick={() => remove(a)} className="inline-flex items-center gap-1 text-[#FF2400] font-medium hover:opacity-80 transition-opacity"><Trash size={15} /> {t("delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent data-testid="agency-credentials-dialog" className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle size={20} className="text-[#008A00]" weight="fill" /> {created?.agency_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("email")}</Label>
              <div className="font-mono text-sm bg-secondary rounded-sm px-3 py-2 mt-1" data-testid="created-agency-email">{created?.email}</div>
            </div>
            <div>
              <Label>{t("generated_password")}</Label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 font-mono text-sm bg-secondary rounded-sm px-3 py-2" data-testid="created-agency-password">{created?.generated_password}</div>
                <button data-testid="copy-password" onClick={() => { navigator.clipboard?.writeText(created.generated_password); toast.success(t("copied")); }}
                  className="border border-black/15 rounded-sm p-2 hover:bg-secondary"><Copy size={16} /></button>
              </div>
            </div>
            <p className="text-xs text-[#FF2400]">{t("agency_created_note")}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent data-testid="agency-edit-dialog" className="max-w-md">
          <DialogHeader><DialogTitle>{t("edit_agency")}</DialogTitle></DialogHeader>
          {edit && (
            <form onSubmit={saveEdit} className="space-y-3">
              <div><Label>{t("agency_name")}</Label><input data-testid="edit-agency-name" required value={edit.agency_name} onChange={(e) => setEdit({ ...edit, agency_name: e.target.value })} className={cls} /></div>
              <div><Label>{t("email")}</Label><input data-testid="edit-agency-email" type="email" required value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className={cls} /></div>
              <div><Label>{t("phone")}</Label><input data-testid="edit-agency-phone" required value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className={cls} /></div>
              <div><Label>{t("address")}</Label><input data-testid="edit-agency-address" required value={edit.address || ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} className={cls} /></div>
              <button data-testid="edit-agency-save" className="w-full brand-bg text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity">{t("save")}</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
