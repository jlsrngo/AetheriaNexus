import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import { UnifiedWorkstationPage } from "../../pages/UnifiedWorkstationPage";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";
import { useAppNetworkStatus } from "./hooks/useAppNetworkStatus";
import { useActiveFolderSync } from "./hooks/useActiveFolderSync";

const StockVaultPage = lazy(() =>
  import("../../pages/StockVaultPage").then((m) => ({ default: m.StockVaultPage }))
);
const SchedulePage = lazy(() =>
  import("../../pages/SchedulePage").then((m) => ({ default: m.SchedulePage }))
);
const AnalyticsPage = lazy(() =>
  import("../../pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage }))
);
const SettingsPage = lazy(() =>
  import("../../pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

export function AppLayout() {
  const location = useLocation();
  const { isOnline } = useAppNetworkStatus();
  const {
    activeFolder,
    handleOpenFolder,
    handleCloseFolder,
  } = useActiveFolderSync();

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        console.info("[ARUNAKI_UI_PAINTED]");
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  const isStudioRoute =
    location.pathname === "/" || location.pathname.startsWith("/workspace");

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 select-none">
      {/* 1. Header Bar */}
      <AppHeader
        activeFolder={activeFolder}
        onOpenFolder={handleOpenFolder}
        onCloseFolder={handleCloseFolder}
      />

      {/* 2. Main Keep-Alive Container */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative bg-neutral-950">
        <div
          className={cn(
            "w-full h-full flex flex-col flex-1",
            !isStudioRoute && "hidden"
          )}
        >
          <UnifiedWorkstationPage />
        </div>

        <Suspense fallback={<div className="w-full h-full flex-1 bg-neutral-950" />}>
          {location.pathname === "/stock" && (
            <div className="w-full h-full flex flex-col flex-1">
              <StockVaultPage />
            </div>
          )}
          {location.pathname === "/schedule" && (
            <div className="w-full h-full flex flex-col flex-1">
              <SchedulePage />
            </div>
          )}
          {location.pathname === "/analytics" && (
            <div className="w-full h-full flex flex-col flex-1">
              <AnalyticsPage />
            </div>
          )}
          {location.pathname === "/settings" && (
            <div className="w-full h-full flex flex-col flex-1">
              <SettingsPage />
            </div>
          )}
        </Suspense>
      </main>

      {/* 3. Footer Bar */}
      <AppFooter
        activeFolder={activeFolder}
        isOnline={isOnline}
        onOpenFolder={handleOpenFolder}
      />
    </div>
  );
}
