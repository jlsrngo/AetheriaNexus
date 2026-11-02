import React from "react";
import { useStudioState } from "./hooks/useStudioState";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { StudioView } from "./components/studio/StudioView";
import { StockView } from "./components/stock/StockView";
import { ScheduleView } from "./components/schedule/ScheduleView";
import { AnalyticsView } from "./components/analytics/AnalyticsView";
import { SettingsView } from "./components/settings/SettingsView";
import { CheckCircle2 } from "lucide-react";

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    props,
    setProps,
    stock,
    isRendering,
    renderProgress,
    notification,
    handleAiGenerate,
    handleRenderToStock,
    handlePublishToTikTok,
    handleSaveSettings,
    handleDeleteStock,
    geminiApiKey,
    outputDir,
    metrics,
    feed,
    readyStockCount,
  } = useStudioState();

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        readyStockCount={readyStockCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header Telemetry */}
        <Header readyStockCount={readyStockCount} />

        {/* Global Notification Toast (Brutalist style) */}
        {notification && (
          <div className="absolute top-16 right-6 z-50 bg-neutral-900 border border-white text-white px-4 py-2 font-mono text-xs flex items-center gap-2.5 shadow-2xl rounded-none">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Dynamic Views */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {activeTab === "studio" && (
            <StudioView
              props={props}
              setProps={setProps}
              onAiGenerate={handleAiGenerate}
              onRender={handleRenderToStock}
              isRendering={isRendering}
              renderProgress={renderProgress}
            />
          )}

          {activeTab === "stock" && (
            <StockView
              stock={stock}
              onUpload={handlePublishToTikTok}
              onNavigateToSchedule={() => setActiveTab("schedule")}
              onNavigateToStudio={() => setActiveTab("studio")}
              onDeleteStock={handleDeleteStock}
            />
          )}

          {activeTab === "schedule" && (
            <ScheduleView onNavigateToStock={() => setActiveTab("stock")} />
          )}

          {activeTab === "analytics" && (
            <AnalyticsView metrics={metrics} feed={feed} />
          )}

          {activeTab === "settings" && (
            <SettingsView
              geminiApiKey={geminiApiKey}
              outputDir={outputDir}
              onSaveSetting={handleSaveSettings}
            />
          )}
        </main>
      </div>
    </div>
  );
};
