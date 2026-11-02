import React from "react";
import { useStudioState } from "./hooks/useStudioState";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { StudioView } from "./components/studio/StudioView";
import { StockView } from "./components/stock/StockView";
import { ScheduleView } from "./components/schedule/ScheduleView";
import { AnalyticsView } from "./components/analytics/AnalyticsView";
import { SettingsView } from "./components/settings/SettingsView";

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    props,
    setProps,
    stock,
    isRendering,
    renderProgress,
    handleAiGenerate,
    handleRenderToStock,
    handlePublishToTikTok,
    handleDeleteStock,
    outputDir,
    handleSaveOutputDir,
    metrics,
    feed,
    readyStockCount,
    providers,
    handleSaveProviders,
    cliStatus,
    handleRefreshClis,
  } = useStudioState();

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none border border-neutral-800">
      {/* VS Code Style Full-Width Titlebar */}
      <Header />

      {/* Main Workspace: Sidebar on Left, Content Views on Right */}
      <div className="flex-1 flex h-[calc(100vh-36px)] overflow-hidden relative">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          readyStockCount={readyStockCount}
        />

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
              providers={providers}
              onSaveProviders={handleSaveProviders}
              cliStatus={cliStatus}
              onRefreshClis={handleRefreshClis}
              outputDir={outputDir}
              onSaveOutputDir={handleSaveOutputDir}
            />
          )}
        </main>
      </div>
    </div>
  );
};
