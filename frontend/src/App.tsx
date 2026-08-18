import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { BottomNav } from "./components/BottomNav";
import { PropertySwitcher } from "./components/PropertySwitcher";
import { PullToRefresh } from "./components/PullToRefresh";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { BillingPage } from "./pages/BillingPage";
import { ClaimsPage } from "./pages/ClaimsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { MorePage } from "./pages/MorePage";
import { ErrorText, LoadingBlock, Spinner } from "./components/ui";
import { api, clearTokens, getAccessToken, hasStoredSession } from "./lib/api";
import { closeTopScreen } from "./lib/backStack";
import { useProperty, usePropertyOptions } from "./lib/data";
import type { NavFocus } from "./lib/notificationNav";
import { tabFromFocus } from "./lib/notificationNav";
import { setupPushNotifications } from "./lib/push";
import { useHardwareBack } from "./lib/useHardwareBack";
import type { Notification, Tab, User } from "./types";
import "./index.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!hasStoredSession()) {
      setBooting(false);
      return;
    }
    api
      .restoreSession()
      .then((session) => setUser(session))
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sand-100">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={setUser} />;
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  // La key remonta el shell en cada cambio de cuenta: sin ella, la sesión
  // siguiente hereda las propiedades y avisos de la anterior.
  return <AppShell key={user.id} user={user} onUserUpdated={setUser} onLogout={logout} />;
}

function AppShell({
  user,
  onUserUpdated,
  onLogout,
}: {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [tabHistory, setTabHistory] = useState<Tab[]>([]);
  const [optionsKey, setOptionsKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [navFocus, setNavFocus] = useState<NavFocus | null>(null);

  const {
    buildings,
    options,
    initialLoading: optionsLoading,
    error: optionsError,
  } = usePropertyOptions(optionsKey);
  const { property, loading, stale, reload } = useProperty(selectedId);

  useEffect(() => {
    void setupPushNotifications();
  }, []);

  const loadNotifications = useCallback(() => {
    if (!getAccessToken()) return;
    api
      .notifications()
      .then(setNotifications)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [tab, loadNotifications]);

  useEffect(() => {
    if (options.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!options.some((o) => o.id === selectedId)) setSelectedId(options[0]!.id);
  }, [options, selectedId]);

  const unread = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const clearFocus = useCallback(() => setNavFocus(null), []);

  const goToTab = useCallback(
    (next: Tab) => {
      if (next === tab) return;
      setTabHistory((history) => [...history, tab]);
      setTab(next);
    },
    [tab],
  );

  /**
   * Atrás cierra primero la pantalla abierta, después desanda las pestañas y
   * por último vuelve a Inicio. Recién ahí deja que Android mande la app al
   * fondo en vez de cerrarla.
   */
  const handleBack = useCallback(() => {
    if (closeTopScreen()) return true;
    if (tabHistory.length > 0) {
      setTab(tabHistory[tabHistory.length - 1]!);
      setTabHistory((history) => history.slice(0, -1));
      return true;
    }
    if (tab !== "inicio") {
      setTab("inicio");
      return true;
    }
    return false;
  }, [tab, tabHistory]);

  useHardwareBack(handleBack);

  const focusReady =
    !navFocus?.propertyId || navFocus.propertyId === selectedId;

  function openFromNotification(focus: NavFocus) {
    if (focus.propertyId && options.some((o) => o.id === focus.propertyId)) {
      setSelectedId(focus.propertyId);
    }
    setNavFocus(focus);
    goToTab(tabFromFocus(focus));
  }

  async function reloadAll() {
    await reload();
    loadNotifications();
  }

  /** Recarga completa del gesto de arrastrar: propiedades, detalle y avisos. */
  async function refreshEverything() {
    setOptionsKey((k) => k + 1);
    await reloadAll();
  }

  // Mientras no tengamos los datos de la propiedad elegida, spinner: mostrar lo
  // de la propiedad anterior confunde más que esperar.
  const waitingForContent = optionsLoading || stale || (loading && !property);
  /** Refresco con contenido ya en pantalla: avisamos sin taparlo. */
  const backgroundBusy = loading && !waitingForContent;

  return (
    <div className="min-h-dvh bg-sand-100 pb-24">
      <AppHeader
        unread={unread}
        onOpenNotifications={() => goToTab("avisos")}
        onOpenProfile={() => goToTab("mas")}
      />

      <PullToRefresh onRefresh={refreshEverything}>
        <div className="mx-auto -mt-11 max-w-3xl space-y-5 px-4">
          <PropertySwitcher
            options={options}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <ErrorText>{optionsError}</ErrorText>

          <main>
            {waitingForContent && tab !== "avisos" ? (
              <LoadingBlock />
            ) : (
              <>
                {tab === "inicio" && (
                  <HomePage
                    property={property}
                    loading={loading}
                    onNavigate={goToTab}
                  />
                )}
                {tab === "facturas" && (
                  <BillingPage
                    property={property}
                    reload={reloadAll}
                    focusPeriodId={
                      focusReady && navFocus?.tab === "facturas"
                        ? navFocus.billingPeriodId
                        : null
                    }
                    focusOpenPayment={
                      focusReady && navFocus?.tab === "facturas"
                        ? Boolean(navFocus.openPayment)
                        : false
                    }
                    onFocusHandled={clearFocus}
                  />
                )}
                {tab === "reclamos" && (
                  <ClaimsPage
                    property={property}
                    reload={reloadAll}
                    focusClaimId={
                      focusReady && navFocus?.tab === "reclamos"
                        ? navFocus.claimId
                        : null
                    }
                    onFocusHandled={clearFocus}
                  />
                )}
                {tab === "avisos" && (
                  <NotificationsPage
                    items={notifications}
                    onChanged={loadNotifications}
                    onOpen={openFromNotification}
                  />
                )}
                {tab === "mas" && (
                  <MorePage
                    user={user}
                    buildings={buildings}
                    property={property}
                    reloadProperty={reload}
                    reloadOptions={() => setOptionsKey((k) => k + 1)}
                    onSelectProperty={setSelectedId}
                    onUserUpdated={onUserUpdated}
                    onLogout={onLogout}
                    focusSheet={
                      focusReady && navFocus?.tab === "mas" ? navFocus.sheet : null
                    }
                    onFocusHandled={clearFocus}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </PullToRefresh>

      {backgroundBusy && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center">
          <span className="flex items-center gap-2 rounded-full bg-ink-900/85 px-3.5 py-2 text-[13px] font-medium text-white shadow-float">
            <Spinner className="size-3.5 border-white/40 border-t-white" />
            Actualizando…
          </span>
        </div>
      )}

      <BottomNav tab={tab} onChange={goToTab} />
    </div>
  );
}
