import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n } from "../i18n";
import { StatusBadge } from "../components/Timeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { ArrowLeft, User, PencilSimple, Trash } from "@phosphor-icons/react";

export default function ClientDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = () => api.get(`/clients/${id}`).then((r) => setData(r.data)).catch(() => navigate("/back-office/clients"));
  useEffect(() => { load(); }, [id]);

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/clients/${id}`, {
        first_name: edit.first_name, last_name: edit.last_name,
        email: edit.email, phone: edit.phone, address: edit.address,
      });
      toast.success(t("client_updated")); setEdit(null); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const remove = async () => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success(t("client_deleted")); navigate("/back-office/clients");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); setConfirmDel(false); }
  };

  const cls = "mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]";
  const Label = ({ children }) => <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{children}</label>;

  if (!data) return <div className="max-w-4xl mx-auto px-4 py-12 font-mono text-sm text-muted-foreground">{t("loading")}</div>;
  const c = data.client;

  return (
    <div data-testid="client-detail-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/back-office/clients" data-testid="back-btn" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={16} /> {t("back")}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("client_details")}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter mt-1 flex items-center gap-2"><User size={28} /> {c.first_name} {c.last_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="client-edit-btn" aria-label={t("edit")} onClick={() => setEdit({ ...c })}
            className="w-10 h-10 flex items-center justify-center rounded-sm border border-black/15 hover:bg-secondary transition-colors"><PencilSimple size={18} /></button>
          <button data-testid="client-delete-btn" aria-label={t("delete")} onClick={() => setConfirmDel(true)}
            className="w-10 h-10 flex items-center justify-center rounded-sm border border-[#FF2400]/40 text-[#FF2400] hover:bg-[#FF2400]/5 transition-colors"><Trash size={18} /></button>
        </div>
      </div>

      <div className="border border-black/10 rounded-sm p-6 mt-6 grid sm:grid-cols-2 gap-y-2 gap-x-8">
        <div className="flex justify-between py-1 border-b border-black/10"><span className="text-sm text-muted-foreground">{t("email")}</span><span className="text-sm font-medium">{c.email}</span></div>
        <div className="flex justify-between py-1 border-b border-black/10"><span className="text-sm text-muted-foreground">{t("phone")}</span><span className="text-sm font-medium">{c.phone}</span></div>
        <div className="flex justify-between py-1 sm:col-span-2 border-b border-black/10"><span className="text-sm text-muted-foreground">{t("address")}</span><span className="text-sm font-medium">{c.address}</span></div>
      </div>

      <h2 className="font-display text-xl font-bold tracking-tight mt-8 mb-3">{t("my_shipments")}</h2>
      <div className="space-y-2">
        {data.shipments.length === 0 ? <p className="text-sm text-muted-foreground">{t("no_shipments")}</p> :
          data.shipments.map((s) => (
            <Link to={`/shipment/${s.id}`} key={s.id} className="flex items-center justify-between border border-black/10 rounded-sm p-3 hover:bg-secondary transition-colors">
              <span className="font-mono text-sm">{s.tracking_number}</span>
              <StatusBadge status={s.status} />
            </Link>
          ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent data-testid="client-edit-dialog" className="max-w-md">
          <DialogHeader><DialogTitle>{t("edit_client")}</DialogTitle></DialogHeader>
          {edit && (
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("first_name")}</Label><input data-testid="edit-client-first-name" required value={edit.first_name} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} className={cls} /></div>
                <div><Label>{t("last_name")}</Label><input data-testid="edit-client-last-name" required value={edit.last_name} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} className={cls} /></div>
              </div>
              <div><Label>{t("email")}</Label><input data-testid="edit-client-email" type="email" required value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className={cls} /></div>
              <div><Label>{t("phone")}</Label><input data-testid="edit-client-phone" required value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className={cls} /></div>
              <div><Label>{t("address")}</Label><input data-testid="edit-client-address" required value={edit.address || ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} className={cls} /></div>
              <button data-testid="edit-client-save" className="w-full brand-bg text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity">{t("save")}</button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDel} message={t("confirm_delete_client")} onConfirm={remove} onCancel={() => setConfirmDel(false)} />
    </div>
  );
}
