import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useI18n } from "../i18n";

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = true }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="confirm-dialog" className="max-w-sm">
        <DialogHeader><DialogTitle>{title || t("confirm")}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2 mt-2">
          <button data-testid="confirm-cancel" onClick={onCancel}
            className="px-4 py-2 rounded-sm text-sm font-medium border border-black/15 hover:bg-secondary transition-colors">{t("cancel")}</button>
          <button data-testid="confirm-ok" onClick={onConfirm}
            className={`px-4 py-2 rounded-sm text-sm font-medium text-white transition-opacity hover:opacity-90 ${danger ? "bg-[#FF2400]" : "brand-bg"}`}>{t("confirm")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
