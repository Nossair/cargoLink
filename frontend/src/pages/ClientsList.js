import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n } from "../i18n";
import { StatusBadge } from "../components/Timeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { User, PencilSimple, Trash } from "@phosphor-icons/react";

export default function ClientsList() {
  const { t } = useI18n();
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);

  const load = () => api.get("/clients").then((r) => setClients(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const open = async (id) => {
    const { data } = await api.get(`/clients/${id}`);
    setDetail(data);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/clients/${edit.id}`, {
        first_name: edit.first_name, last_name: edit.last_name,
        email: edit.email, phone: edit.phone, address: edit.address,
      });
      toast.success(t("client_updated"));
      setEdit(null); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const remove = async (c) => {
    if (!window.confirm(t("confirm_delete_client"))) return;
    try {
      await api.delete(`/clients/${c.id}`);
      toast.success(t("client_deleted")); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const filtered = clients.filter((c) =>
    q === "" || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.toLowerCase()) ||
    c.email.toLowerCase().includes(q.toLowerCase()) || (c.phone || "").includes(q));

  const cls = "mt-1 w-full border border-black/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#002FA7]";
  const Label = ({ children }) => <label className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">{children}</label>;

  return (
    <div data-testid="bo-clients" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter">{t("nav_clients")}</h1>
      <input data-testid="client-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")}
        className="mt-6 w-full max-w-md border border-black/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#002FA7]" />

      <div className="border border-black/10 rounded-sm overflow-x-auto mt-6">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-start p-3 font-medium">{t("first_name")}</th>
              <th className="text-start p-3 font-medium">{t("email")}</th>
              <th className="text-start p-3 font-medium">{t("phone")}</th>
              <th className="text-start p-3 font-medium">{t("my_shipments")}</th>
              <th className="text-start p-3 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} data-testid={`client-row-${c.email}`} className="border-t border-black/10 hover:bg-secondary/40">
                <td className="p-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="p-3 text-muted-foreground">{c.email}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c.shipment_count}</td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <button data-testid={`client-view-${c.email}`} onClick={() => open(c.id)} className="brand-text font-medium">{t("view")}</button>
                    <button data-testid={`client-edit-${c.email}`} onClick={() => setEdit({ ...c })} className="inline-flex items-center gap-1 font-medium hover:brand-text transition-colors"><PencilSimple size={15} /> {t("edit")}</button>
                    <button data-testid={`client-delete-${c.email}`} onClick={() => remove(c)} className="inline-flex items-center gap-1 text-[#FF2400] font-medium hover:opacity-80 transition-opacity"><Trash size={15} /> {t("delete")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent data-testid="client-dialog" className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><User size={20} /> {detail.client.first_name} {detail.client.last_name}</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground">{detail.client.email} · {detail.client.phone}</div>
              <div className="text-sm">{detail.client.address}</div>
              <h4 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-4">{t("my_shipments")}</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {detail.shipments.length === 0 ? <p className="text-sm text-muted-foreground">{t("no_shipments")}</p> :
                  detail.shipments.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border border-black/10 rounded-sm p-2.5">
                      <span className="font-mono text-sm">{s.tracking_number}</span>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
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
    </div>
  );
}
