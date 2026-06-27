import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth, isStaff, isAdmin } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { Package, SignOut, Globe, List, X } from "@phosphor-icons/react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => { setMobileOpen(false); await logout(); navigate("/"); };

  const links = user && !isStaff(user)
    ? [
        { to: "/app", label: t("nav_dashboard"), testid: "nav-dashboard" },
        { to: "/app/new", label: t("nav_new_shipment"), testid: "nav-new-shipment" },
        { to: "/track", label: t("nav_track"), testid: "nav-track" },
        { to: "/estimate", label: t("nav_estimate"), testid: "nav-estimate" },
      ]
    : isStaff(user)
    ? [
        { to: "/back-office", label: t("nav_dashboard"), testid: "nav-bo-dashboard" },
        { to: "/back-office/new-shipment", label: t("new_shipment_staff"), testid: "nav-bo-new-shipment" },
        { to: "/back-office/shipments", label: t("nav_shipments"), testid: "nav-bo-shipments" },
        { to: "/back-office/clients", label: t("nav_clients"), testid: "nav-bo-clients" },
        ...(isAdmin(user) ? [{ to: "/back-office/agencies", label: t("nav_agencies"), testid: "nav-bo-agencies" }] : []),
        { to: "/scanner", label: t("nav_scanner"), testid: "nav-bo-scanner" },
      ]
    : [];

  const NavLink = ({ to, label, testid }) => (
    <Link to={to} data-testid={testid}
      className={`text-sm font-medium px-3 py-1.5 rounded-sm transition-colors hover:bg-secondary ${pathname === to ? "brand-text" : "text-foreground"}`}>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-black/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to={user ? (isStaff(user) ? "/back-office" : "/app") : "/"} data-testid="logo-link" className="flex items-center gap-2">
          <div className="w-9 h-9 brand-bg rounded-sm flex items-center justify-center">
            <Package size={20} weight="bold" color="#fff" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tighter">{t("brand")}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => <NavLink key={l.to} {...l} />)}
        </nav>

        <div className="flex items-center gap-2">
          <button data-testid="lang-toggle" onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
            className="flex items-center gap-1 text-sm font-medium px-2.5 py-1.5 rounded-sm border border-black/10 hover:bg-secondary transition-colors">
            <Globe size={16} /> {lang === "fr" ? "AR" : "FR"}
          </button>
          {user ? (
            <button data-testid="logout-button" onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-sm hover:bg-secondary transition-colors">
              <SignOut size={16} /> <span className="hidden sm:inline">{t("nav_logout")}</span>
            </button>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="hidden md:inline text-sm font-medium px-3 py-1.5 rounded-sm hover:bg-secondary transition-colors">{t("nav_login")}</Link>
              <Link to="/register" data-testid="nav-register" className="hidden md:inline text-sm font-medium px-4 py-1.5 rounded-sm brand-bg text-white hover:opacity-90 transition-opacity">{t("nav_register")}</Link>
            </>
          )}
          <button data-testid="mobile-menu-toggle" onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-sm border border-black/10 hover:bg-secondary transition-colors">
            {mobileOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div data-testid="mobile-menu" className="md:hidden border-t border-black/10 bg-white">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} data-testid={`mobile-${l.testid}`}
                className={`text-sm font-medium px-3 py-2.5 rounded-sm transition-colors hover:bg-secondary ${pathname === l.to ? "brand-text" : "text-foreground"}`}>
                {l.label}
              </Link>
            ))}
            {user ? (
              <button data-testid="mobile-logout-button" onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2.5 rounded-sm hover:bg-secondary transition-colors text-start">
                <SignOut size={16} /> {t("nav_logout")}
              </button>
            ) : (
              <>
                <Link to="/login" data-testid="mobile-nav-login" className="text-sm font-medium px-3 py-2.5 rounded-sm hover:bg-secondary transition-colors">{t("nav_login")}</Link>
                <Link to="/register" data-testid="mobile-nav-register" className="text-sm font-medium px-3 py-2.5 rounded-sm brand-bg text-white text-center hover:opacity-90 transition-opacity">{t("nav_register")}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
