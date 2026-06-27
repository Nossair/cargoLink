import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n } from "../i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { ArrowLeft, Buildings, PencilSimple, Trash } from "@phosphor-icons/react";

export default function AgencyDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [a, setA] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = () => api.get(`/agencies/${id}`).then((r) => setA(r.data)).catch(() => navigate("/back-office/agencies"));
  useEffect(() => { load(); }, [id]);

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/agencies/${id}`, {
        agency_name: edit.agency_name, email: edit.email, phone: edit.phone, address: edit.address,
      });
      toast.success(t("agency_updated")); setEdit(null); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const remove = async () => {
    try {
      await api.delete(`/agencies/${id}`);
      toast.success(t("agency_deleted")); navigate("/back-office/agencies");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); setConfirmDel(false); }
  };

  const cls = "mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]";
  const Label = ({ children }) => <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{children}</label>;

  if (!a) return <div className="max-w-4xl mx-auto px-4 py-12 font-mono text-sm text-muted-foreground">{t("loading")}</div>;

  return (
    <div data-testid="agency-detail-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/back-office/agencies" data-testid="back-btn" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={16} /> {t("back")}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("agency_details")}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter mt-1 flex items-center gap-2"><Buildings size={28} className="brand-text" /> {a.agency_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="agency-edit-btn" aria-label={t("edit")} onClick={() => setEdit({ ...a })}
            className="w-10 h-10 flex items-center justify-center rounded-sm border border-black/15 hover:bg-secondary transition-colors"><PencilSimple size={18} /></button>
          <button data-testid="agency-delete-btn" aria-label={t("delete")} onClick={() => setConfirmDel(true)}
            className="w-10 h-10 flex items-center justify-center rounded-sm border border-[#FF2400]/40 text-[#FF2400] hover:bg-[#FF2400]/5 transition-colors"><Trash size={18} /></button>
        </div>
      </div>

      <div className="border border-black/10 rounded-sm p-6 mt-6 grid sm:grid-cols-2 gap-y-2 gap-x-8">
        <div className="flex justify-between py-1 border-b border-black/10"><span className="text-sm text-muted-foreground">{t("email")}</span><span className="text-sm font-medium">{a.email}</span></div>
        <div className="flex justify-between py-1 border-b border-black/10"><span className="text-sm text-muted-foreground">{t("phone")}</span><span className="text-sm font-medium">{a.phone}</span></div>
        <div className="flex justify-between py-1 sm:col-span-2 border-b border-black/10"><span className="text-sm text-muted-foreground">{t("address")}</span><span className="text-sm font-medium">{a.address}</span></div>
        <div className="flex justify-between py-1"><span className="text-sm text-muted-foreground">{t("created_count")}</span><span className="text-sm font-medium">{a.created_count}</span></div>
      </div>

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

      <ConfirmDialog open={confirmDel} message={t("confirm_delete_agency")} onConfirm={remove} onCancel={() => setConfirmDel(false)} />
    </div>
  );
}
