import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, isStaff } from "../context/AuthContext";
import { useI18n } from "../i18n";

export default function ProtectedRoute({ children, staffOnly = false }) {
  const { user, checked } = useAuth();
  const { t } = useI18n();
  if (!checked || user === null) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-sm text-muted-foreground">{t("loading")}</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (staffOnly && !isStaff(user)) return <Navigate to="/app" replace />;
  return children;
}
